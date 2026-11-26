import { describe, it, expect } from "vitest";
import { provider, wav } from "../lib/tts";
import { inputSchema } from "../lib/script";
describe("real offline synthesis (not mocked)", () => {
  it("bounds audio size and recovers for the next request", async () => {
    await expect(
      provider.synthesize(
        inputSchema.parse({
          text: "Hello " + "[break 10s]".repeat(10),
          voice: "en-us",
        }),
      ),
    ).rejects.toThrow("AUDIO_LIMIT");
    expect(
      (
        await provider.synthesize(
          inputSchema.parse({ text: "Hello again.", voice: "en-us" }),
        )
      ).duration,
    ).toBeGreaterThan(0);
  });
  it("writes valid PCM WAV metadata", () => {
    const b = wav(new Int16Array([100, -100]));
    expect(b.toString("ascii", 0, 4)).toBe("RIFF");
    expect(b.readUInt32LE(24)).toBe(22050);
    expect(b.readUInt32LE(40)).toBe(4);
  });
  it.each(["bn", "bn+f3", "en-us", "en-us+f3", "en-gb", "en-gb+f3"])(
    "generates real audio: %s",
    async (voice) => {
      const r = await provider.synthesize(
        inputSchema.parse({
          text: voice.startsWith("bn") ? "আমি বাংলা বলি।" : "Hello world.",
          voice,
        }),
      );
      expect(r.audio.length).toBeGreaterThan(1000);
      expect(r.duration).toBeGreaterThan(0.2);
      expect(Math.max(...r.peaks)).toBeGreaterThan(0);
    },
  );
  it("encodes an actual MP3", async () => {
    const r = await provider.synthesize(
      inputSchema.parse({
        text: "Hello from the studio.",
        voice: "en-us",
        format: "mp3",
      }),
    );
    expect(r.audio.length).toBeGreaterThan(1000);
    expect(r.audio[0]).toBe(255);
    expect(r.audio[1] & 224).toBe(224);
  });
  it("inserts PCM silence at the exact sample rate", async () => {
    const base = { text: "Hello", voice: "en-us" };
    const a = await provider.synthesize(inputSchema.parse(base));
    const b = await provider.synthesize(
      inputSchema.parse({ ...base, text: "Hello [break 1s]" }),
    );
    expect(b.duration - a.duration).toBeCloseTo(1, 1);
  });
});
