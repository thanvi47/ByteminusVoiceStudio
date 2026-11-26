import init from "@echogarden/espeak-ng-emscripten";
import { Mp3Encoder } from "@breezystack/lamejs";
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
    };
  } catch {
    return {
      engines: { mithi: false, kokoro: false, parler: false },
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
async function neuralSynthesize(input: SynthesisInput) {
  const profile = voices.find((v) => v.id === input.voice)!;
  const d =
    profile.styleMode === "prompted"
      ? { rate: 1, pitch: 1 }
      : delivery(input.emotion, input.intensity);
  let response: Response;
  try {
    response = await fetch("http://127.0.0.1:8123/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: input.text,
        voice: input.voice,
        emotion: input.emotion,
        intensity: input.intensity,
        rate: input.rate,
        pitch: input.pitch,
        style: input.style,
        deliveryRate: d.rate,
        deliveryPitch: d.pitch,
      }),
      signal: AbortSignal.timeout(650000),
    });
  } catch {
    throw new Error("NEURAL_OFFLINE");
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
    buffer.length > 90 * sampleRate * 2
  )
    throw new Error("AUDIO_LIMIT");
  const pcm = new Int16Array(buffer.length / 2);
  for (let i = 0; i < pcm.length; i++) pcm[i] = buffer.readInt16LE(i * 2);
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
        styleMode: "approximate",
        languages: ["bn"],
      },
      {
        id: "kokoro",
        neural: true,
        styleMode: "approximate",
        languages: ["en-US", "en-GB"],
      },
      { id: "parler", neural: true, styleMode: "prompted", languages: ["en"] },
      { id: "espeak", neural: false, styleMode: "approximate", legacy: true },
    ],
    formats: ["wav", "mp3"],
    sampleRates: [22050, 24000],
    accentNote: "Bengali is generic; no verified Bangladesh or India accent.",
  }),
  async synthesize(input) {
    if (waiting >= 3) throw new Error("BUSY");
    waiting++;
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((r) => {
      release = r;
    });
    await previous;
    try {
      const parsed = parseScript(input.text);
      if (input.voice.includes(":")) return await neuralSynthesize(input);
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
      for (const part of parsed) {
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
      }
      const length = chunks.reduce((a, c) => a + c.length, 0);
      if (!length) throw new Error("EMPTY_AUDIO");
      const pcm = new Int16Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        pcm.set(chunk, offset);
        offset += chunk.length;
      }
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
      usage.failed++;
      throw e;
    } finally {
      waiting--;
      release();
    }
  },
};
