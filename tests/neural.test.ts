import { afterEach, describe, it, expect, vi } from "vitest";
import { encode, provider, neuralStatus } from "../lib/tts";
import { voices, inputSchema } from "../lib/script";
const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../lib/neural-http", () => ({ postNeural: post }));
afterEach(() => { vi.unstubAllGlobals(); post.mockReset(); });
describe("neural interoperability", () => {
  it("uses the selected engine's hardware budget and joins all sections before export", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ device: "cpu",
      hardware: { batchCharacters: 300 }, engineHardware: { parler: { batchCharacters: 160 } } })));
    post.mockImplementation(() => Promise.resolve(new Response(new Uint8Array(4800), { headers: { "X-Sample-Rate": "24000" } })));
    const result = await provider.synthesize(inputSchema.parse({ text: "Hello world. ".repeat(70), voice: "parler:Lea" }));
    expect(post.mock.calls.length).toBeGreaterThan(4);
    expect(post.mock.calls.every(([body]) => JSON.parse(body).text.length <= 160)).toBe(true);
    expect(result.duration).toBeCloseTo(post.mock.calls.length * 0.1);
  });
  it("preserves long pause-only sections without submitting an invalid speech job", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ hardware: { batchCharacters: 160 } })));
    post.mockImplementation((body) => {
      const pauses = [...JSON.parse(body).text.matchAll(/\[pause 10s\]/g)].length;
      return Promise.resolve(new Response(new Uint8Array(4800 + pauses * 480000), { headers: { "X-Sample-Rate": "24000" } }));
    });
    const result = await provider.synthesize(inputSchema.parse({ text: "[pause 10s] ".repeat(30) + "Hello.", voice: "parler:Lea" }));
    expect(result.duration).toBeGreaterThanOrEqual(300);
    expect(post.mock.calls.every(([body]) => /Hello/.test(JSON.parse(body).text))).toBe(true);
  });
  it.each(["mithi:charvi", "kokoro:af_heart"])("never turns emotion into pitch or time-stretch effects for %s", async (voice) => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(new Uint8Array(4800), {
      headers: { "X-Sample-Rate": "24000" },
    })));
    post.mockImplementation(fetchMock);
    await provider.synthesize(inputSchema.parse({ text: "Hello.", voice, emotion: "Funny", intensity: 100, rate: 1, pitch: 1 }));
    const sent = JSON.parse(fetchMock.mock.calls[0][0]);
    expect(sent.deliveryPitch).toBe(1);
    expect(sent.deliveryRate).toBe(1);
    expect(sent.pitch).toBe(1);
    expect(sent.rate).toBe(1);
    expect(sent.emotion).toBe("Neutral");
    expect(sent.intensity).toBe(0);
  });
  it("rejects Bengali scripts for English-only neural voices", () => {
    expect(
      inputSchema.safeParse({
        text: "আমি বাংলা বলি।",
        voice: "kokoro:af_heart",
      }).success,
    ).toBe(false);
    expect(
      inputSchema.safeParse({ text: "আমি বাংলা বলি।", voice: "parler:Lea" })
        .success,
    ).toBe(false);
    expect(
      inputSchema.safeParse({ text: "আমি বাংলা বলি।", voice: "mithi:charvi" })
        .success,
    ).toBe(true);
  });
  it("exposes real model IDs and separates prompted styles", () => {
    expect(voices.filter((v) => v.engine === "mithi")).toHaveLength(10);
    expect(voices.filter((v) => v.engine === "kokoro")).toHaveLength(28);
    expect(voices.filter((v) => v.engine === "parler")).toHaveLength(34);
    expect(
      voices
        .filter((v) => v.engine === "parler")
        .every((v) => v.styleMode === "prompted"),
    ).toBe(true);
  });
  it("does not substitute robotic audio if the service is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    post.mockRejectedValue(Object.assign(new Error("refused"), { code: "ECONNREFUSED" }));
    await expect(
      provider.synthesize(
        inputSchema.parse({ text: "Hello", voice: "kokoro:af_heart" }),
      ),
    ).rejects.toThrow("NEURAL_OFFLINE");
    expect((await neuralStatus()).device).toBe("unavailable");
  });
  it("preserves provider errors and rejects invalid PCM responses", async () => {
    post.mockResolvedValue(Response.json({ detail: "Model not installed" }, { status: 503 }));
    await expect(
      provider.synthesize(
        inputSchema.parse({ text: "Hello", voice: "mithi:charvi" }),
      ),
    ).rejects.toThrow("Model not installed");
    post.mockResolvedValue(
        new Response(new Uint8Array([0]), {
          headers: { "X-Sample-Rate": "24000" },
        }),
    );
    await expect(
      provider.synthesize(
        inputSchema.parse({ text: "Hello", voice: "mithi:charvi" }),
      ),
    ).rejects.toThrow("AUDIO_LIMIT");
  });
  it("preserves neural sample rates in export metadata", () => {
    const audio = encode(new Int16Array([100, -100]), 24000, "wav");
    expect(audio.readUInt32LE(24)).toBe(24000);
    expect(audio.readUInt32LE(28)).toBe(48000);
  });
  it("applies output volume to the exported WAV and waveform rather than only the player", async () => {
    const pcm = Int16Array.from({ length: 2400 }, (_, i) =>
        Math.round(1000 * Math.sin(i * 0.1)),
      ),
      bytes = Buffer.from(pcm.buffer);
    post.mockImplementation(() =>
          Promise.resolve(
            new Response(bytes, { headers: { "X-Sample-Rate": "24000" } }),
          ),
    );
    const base = inputSchema.parse({
      text: "Hello.",
      voice: "kokoro:af_heart",
      normalizeAudio: false,
    });
    const quiet = await provider.synthesize(base),
      loud = await provider.synthesize({ ...base, outputGain: 2 });
    expect(loud.duration).toBe(quiet.duration);
    expect(Math.max(...loud.peaks)).toBeGreaterThan(
      Math.max(...quiet.peaks) * 1.9,
    );
    expect(loud.audio.readInt16LE(44 + 20)).toBeGreaterThan(
      quiet.audio.readInt16LE(44 + 20) * 1.9,
    );
  });
  it("distinguishes a slow response from an offline server", async () => {
    const input = inputSchema.parse({ text: "Hello", voice: "indic:Aditi" });
    post.mockRejectedValue(Object.assign(new Error("deadline"), { code: "NEURAL_TIMEOUT" }));
    await expect(provider.synthesize(input)).rejects.toThrow("NEURAL_TIMEOUT");
    post.mockRejectedValue(Object.assign(new Error("reset"), { code: "ECONNRESET" }));
    await expect(provider.synthesize(input)).rejects.toThrow("NEURAL_CONNECTION");
  });
  it("validates custom voice direction length", () =>
    expect(
      inputSchema.safeParse({
        text: "Hello",
        voice: "parler:Jon",
        style: "x".repeat(1201),
      }).success,
    ).toBe(false));
});
