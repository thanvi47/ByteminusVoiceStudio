import { afterEach, describe, it, expect, vi } from "vitest";
import { encode, provider, neuralStatus } from "../lib/tts";
import { voices, inputSchema } from "../lib/script";
afterEach(() => vi.unstubAllGlobals());
describe("neural interoperability", () => {
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
    await expect(
      provider.synthesize(
        inputSchema.parse({ text: "Hello", voice: "kokoro:af_heart" }),
      ),
    ).rejects.toThrow("NEURAL_OFFLINE");
    expect((await neuralStatus()).device).toBe("unavailable");
  });
  it("preserves provider errors and rejects invalid PCM responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ detail: "Model not installed" }, { status: 503 }),
        ),
    );
    await expect(
      provider.synthesize(
        inputSchema.parse({ text: "Hello", voice: "mithi:charvi" }),
      ),
    ).rejects.toThrow("Model not installed");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(new Uint8Array([0]), {
          headers: { "X-Sample-Rate": "24000" },
        }),
      ),
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
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(
            new Response(bytes, { headers: { "X-Sample-Rate": "24000" } }),
          ),
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
  it("validates custom voice direction length", () =>
    expect(
      inputSchema.safeParse({
        text: "Hello",
        voice: "parler:Jon",
        style: "x".repeat(1201),
      }).success,
    ).toBe(false));
});
