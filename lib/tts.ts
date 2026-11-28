import init from "@echogarden/espeak-ng-emscripten";
import { Mp3Encoder } from "@breezystack/lamejs";
import { masterPcm } from "./audio-levels.mjs";
import { postNeural } from "./neural-http";
import { speechBatches } from "./speech-batches";
import { observeRender, estimateRender } from "./render-estimate";
import { throwIfCancelled, waitForTurn, type GenerationControl } from "./generation-jobs";
import {
  delivery,
  escapeXML,
  parseScript,
  voices,
  type SynthesisInput,
} from "./script";
export interface TTSProvider {
  getVoices(): typeof voices;
  getUsageInfo(): typeof usage;
  getCapabilities(): object;
  synthesize(
    input: SynthesisInput,
    control?: GenerationControl,
  ): Promise<{ audio: Buffer; duration: number; peaks: number[] }>;
}
export function wav(pcm: Int16Array, sampleRate = 22050) {
  const out = Buffer.alloc(44 + pcm.length * 2);
  out.write("RIFF");
  out.writeUInt32LE(out.length - 8, 4);
  out.write("WAVEfmt ", 8);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(1, 22);
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * 2, 28);
  out.writeUInt16LE(2, 32);
  out.writeUInt16LE(16, 34);
  out.write("data", 36);
  out.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) out.writeInt16LE(pcm[i], 44 + i * 2);
  return out;
}
let engine: Promise<any> | undefined;
let queue = Promise.resolve();
let waiting = 0;
export const usage = {
  characters: 0,
  requests: 0,
  failed: 0,
  started: new Date().toISOString(),
};
export async function neuralStatus() {
  try {
    const response = await fetch("http://127.0.0.1:8123/health", {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error();
    return (await response.json()) as {
      engines: Record<string, boolean>;
      device: string;
      hardware?: { name: string; backend?: string; device?: string; cpuThreads: number; batchCharacters: number; maxScriptCharacters?: number; maxAudioSeconds?: number; reason?: string };
      engineHardware?: Record<string, { name?: string; backend?: string; device?: string; cpuThreads?: number; batchCharacters: number; maxScriptCharacters?: number; maxAudioSeconds?: number }>;
    };
  } catch {
    return {
      engines: { mithi: false, kokoro: false, parler: false, indic: false },
      device: "unavailable",
    };
  }
}
export function encode(
  pcm: Int16Array,
  sampleRate: number,
  format: "wav" | "mp3",
) {
  if (format === "wav") return wav(pcm, sampleRate);
  const encoder = new Mp3Encoder(1, sampleRate, 96);
  const chunks: Buffer[] = [];
  for (let i = 0; i < pcm.length; i += 1152)
    chunks.push(Buffer.from(encoder.encodeBuffer(pcm.subarray(i, i + 1152))));
  chunks.push(Buffer.from(encoder.flush()));
  return Buffer.concat(chunks);
}
async function neuralPart(input: SynthesisInput, control?: GenerationControl) {
  // Neural emotion comes from a model prompt, never a synthetic pitch/speed effect.
  // Natural engines ignore emotion; explicit manual sliders remain available.
  let response: Response;
  try {
    response = await postNeural(JSON.stringify({
        text: input.text,
        voice: input.voice,
        emotion: input.emotion,
        intensity: input.intensity,
        rate: input.rate,
        pitch: input.pitch,
        style: input.style,
        deliveryRate: 1,
        deliveryPitch: 1,
        generationId: control?.id,
      }));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "NEURAL_TIMEOUT") throw new Error("NEURAL_TIMEOUT");
    if (code === "NEURAL_RESPONSE_LIMIT") throw new Error("AUDIO_LIMIT");
    if (code === "ECONNREFUSED") throw new Error("NEURAL_OFFLINE");
    console.error("Neural connection failed:", code ?? "unknown");
    throw new Error("NEURAL_CONNECTION");
  }
  if (!response.ok) {
    let detail = "Neural speech failed.";
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {}
    throw new Error("NEURAL: " + detail);
  }
  const sampleRate = Number(response.headers.get("X-Sample-Rate"));
  if (![22050, 24000, 44100, 48000].includes(sampleRate))
    throw new Error("NEURAL: Invalid audio sample rate.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (
    !buffer.length ||
    buffer.length % 2 ||
    buffer.length > 600 * sampleRate * 2
  )
    throw new Error("AUDIO_LIMIT");
  return { buffer, sampleRate };
}
async function neuralSynthesize(input: SynthesisInput, control?: GenerationControl) {
  throwIfCancelled(control);
  control?.update({ stage: "Checking the local speech engine…" });
  const status = await neuralStatus();
  const engineName = input.voice.split(":")[0];
  const hardware = status?.engineHardware?.[engineName] ?? status?.hardware;
  const budget = Math.max(40, Math.min(1200, hardware?.batchCharacters ?? 300));
  const maxAudio = Math.max(90, Math.min(1800, hardware?.maxAudioSeconds ?? 600));
  const batches = input.text.length > budget ? speechBatches(input.text, budget) : [input.text];
  const estimateKey = JSON.stringify([input.voice, input.emotion, input.intensity, input.rate, input.pitch, hardware?.backend ?? hardware?.device ?? status.device, hardware?.name, hardware?.cpuThreads]);
  let remainingCharacters = batches.reduce((sum, text) => sum + text.length, 0);
  const updateEstimate = () => {
    const estimate = estimateRender(estimateKey, remainingCharacters);
    control?.update({ estimate: estimate ? { ...estimate, updated: Date.now() } : null });
  };
  updateEstimate();
  const buffers: Buffer[] = [];
  let sampleRate = 0, bytes = 0;
  let completed = 0;
  control?.update({ total: batches.length, completed: 0 });
  for (const text of batches) {
    throwIfCancelled(control);
    control?.update({ stage: `Rendering section ${completed + 1} of ${batches.length}. First use may load the model…` });
    const pauseTag = /\[pause (\d+(?:\.\d+)?)s\]/g;
    const onlyPauses = !text.replace(pauseTag, "").trim();
    const pauseSeconds = onlyPauses ? [...text.matchAll(pauseTag)].reduce((sum, m) => sum + Number(m[1]), 0) : 0;
    const started = performance.now();
    const part = onlyPauses ? { buffer: Buffer.alloc(Math.round(pauseSeconds * 24000) * 2), sampleRate: 24000 }
      : await neuralPart({ ...input, text }, control);
    throwIfCancelled(control);
    if (!onlyPauses) observeRender(estimateKey, text.length, (performance.now() - started) / 1000);
    remainingCharacters -= text.length;
    updateEstimate();
    if (sampleRate && sampleRate !== part.sampleRate) throw new Error("NEURAL: Audio sample rate changed between sections.");
    sampleRate = part.sampleRate;
    bytes += part.buffer.length;
    if (bytes > maxAudio * sampleRate * 2) throw new Error("AUDIO_LIMIT");
    buffers.push(part.buffer);
    completed++;
    control?.update({ completed, percent: Math.floor(completed / batches.length * 95) });
  }
  throwIfCancelled(control);
  control?.update({ percent: 97, estimate: null, stage: "Preparing audio levels and download…" });
  const buffer = Buffer.concat(buffers);
  const pcm = new Int16Array(buffer.length / 2);
  for (let i = 0; i < pcm.length; i++) pcm[i] = buffer.readInt16LE(i * 2);
  pcm.set(
    masterPcm(pcm, sampleRate, {
      gain: input.outputGain,
      normalize: input.normalizeAudio,
    }),
  );
  const peaks = Array.from({ length: 100 }, (_, i) => {
    let peak = 0;
    for (
      let j = Math.floor((i * pcm.length) / 100);
      j < Math.floor(((i + 1) * pcm.length) / 100);
      j++
    )
      peak = Math.max(peak, Math.abs(pcm[j]));
    return peak / 32768;
  });
  usage.characters += input.text.length;
  usage.requests++;
  return {
    audio: encode(pcm, sampleRate, input.format),
    duration: pcm.length / sampleRate,
    peaks,
  };
}
export const provider: TTSProvider = {
  getVoices: () => voices,
  getUsageInfo: () => ({ ...usage }),
  getCapabilities: () => ({
    provider: "Local neural studio",
    providers: [
      {
        id: "mithi",
        neural: true,
        styleMode: "natural",
        languages: ["bn"],
      },
      {
        id: "kokoro",
        neural: true,
        styleMode: "natural",
        languages: ["en-US", "en-GB"],
      },
      { id: "parler", neural: true, styleMode: "prompted", languages: ["en"] },
      {
        id: "indic",
        neural: true,
        styleMode: "prompted",
        languages: ["bn-expressive"],
      },
      { id: "espeak", neural: false, styleMode: "approximate", legacy: true },
    ],
    formats: ["wav", "mp3"],
    sampleRates: [22050, 24000],
    accentNote: "Bengali is generic; no verified Bangladesh or India accent.",
  }),
  async synthesize(input, control) {
    if (waiting >= 3) throw new Error("BUSY");
    waiting++;
    const previous = queue;
    let release!: () => void;
    const turn = new Promise<void>((r) => {
      release = r;
    });
    queue = previous.then(() => turn);
    try {
      await waitForTurn(previous, control);
      throwIfCancelled(control);
      const parsed = parseScript(input.text);
      if (input.voice.includes(":")) return await neuralSynthesize(input, control);
      engine ??= init()
        .then(async (m) => new m.eSpeakNGWorker())
        .catch((e) => {
          engine = undefined;
          throw e;
        });
      const e = await engine;
      e.set_voice(input.voice);
      const d = delivery(input.emotion, input.intensity);
      e.set_rate(input.rate * d.rate);
      e.set_pitch(input.pitch * d.pitch);
      const chunks: Int16Array[] = [];
      let samplesWritten = 0;
      const append = (chunk: Int16Array) => {
        samplesWritten += chunk.length;
        if (samplesWritten > 90 * 22050) throw new Error("AUDIO_LIMIT");
        chunks.push(chunk);
      };
      let completed = 0;
      for (const part of parsed) {
        throwIfCancelled(control);
        control?.update({ total: parsed.length, stage: "Rendering legacy speech sections…" });
        if (part.pause !== undefined)
          append(new Int16Array(Math.round(part.pause * 22050)));
        else if (part.text?.trim()) {
          let exceeded = false;
          e.synthesize(escapeXML(part.text), (samples: Int16Array) => {
            if (!samples?.length || exceeded) return;
            if (samplesWritten + samples.length > 90 * 22050) {
              exceeded = true;
              return;
            }
            append(new Int16Array(samples));
          });
          if (exceeded) throw new Error("AUDIO_LIMIT");
        }
        completed++;
        control?.update({ completed, percent: Math.floor(completed / parsed.length * 95) });
      }
      const length = chunks.reduce((a, c) => a + c.length, 0);
      throwIfCancelled(control);
      control?.update({ percent: 97, stage: "Preparing audio levels and download…" });
      if (!length) throw new Error("EMPTY_AUDIO");
      const pcm = new Int16Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        pcm.set(chunk, offset);
        offset += chunk.length;
      }
      pcm.set(
        masterPcm(pcm, 22050, {
          gain: input.outputGain,
          normalize: input.normalizeAudio,
        }),
      );
      const peaks = Array.from({ length: 100 }, (_, i) => {
        let peak = 0;
        const start = Math.floor((i * length) / 100),
          end = Math.floor(((i + 1) * length) / 100);
        for (let j = start; j < end; j++)
          peak = Math.max(peak, Math.abs(pcm[j]));
        return peak / 32768;
      });
      let audio: Buffer;
      if (input.format === "wav") audio = wav(pcm);
      else {
        const encoder = new Mp3Encoder(1, 22050, 96);
        const encoded: Buffer[] = [];
        for (let i = 0; i < pcm.length; i += 1152)
          encoded.push(
            Buffer.from(encoder.encodeBuffer(pcm.subarray(i, i + 1152))),
          );
        encoded.push(Buffer.from(encoder.flush()));
        audio = Buffer.concat(encoded);
      }
      usage.characters += input.text.length;
      usage.requests++;
      return { audio, duration: length / 22050, peaks };
    } catch (e) {
      if (!(e instanceof Error && e.message === "GENERATION_CANCELLED")) usage.failed++;
      throw e;
    } finally {
      waiting--;
      release();
    }
  },
};
