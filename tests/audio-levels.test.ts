import { describe, it, expect } from "vitest";
import { masterPcm } from "../lib/audio-levels.mjs";
import { voices, inputSchema, synthesisKey } from "../lib/script";
function tone(amplitude = 0.025) {
  return Int16Array.from({ length: 24000 }, (_, i) =>
    Math.round(Math.sin((i * 2 * Math.PI * 200) / 24000) * 32767 * amplitude),
  );
}
function rms(pcm: Int16Array) {
  return Math.sqrt(
    pcm.reduce((sum, v) => sum + (v / 32768) ** 2, 0) / pcm.length,
  );
}
describe("speech loudness and delivery presets", () => {
  it("raises quiet speech without changing duration or pause samples", () => {
    const signal = tone(),
      withPause = new Int16Array(48000);
    withPause.set(signal, 12000);
    const result = masterPcm(withPause, 24000);
    expect(result.length).toBe(withPause.length);
    expect(rms(result)).toBeGreaterThan(rms(withPause) * 4);
    expect(result.subarray(0, 12000).every((v) => v === 0)).toBe(true);
    expect(result.subarray(36000).every((v) => v === 0)).toBe(true);
  });
  it("supports manual gain and mute independently of automatic loudness", () => {
    const signal = tone(0.1);
    expect(
      rms(masterPcm(signal, 24000, { normalize: false, gain: 2 })),
    ).toBeCloseTo(rms(signal) * 2, 3);
    expect(masterPcm(signal, 24000, { gain: 0 }).every((v) => v === 0)).toBe(
      true,
    );
    expect(masterPcm(signal, 24000, { normalize: false, gain: 1 })).toEqual(
      signal,
    );
  });
  it("limits large boosted peaks without integer wraparound", () => {
    const signal = tone(0.9),
      result = masterPcm(signal, 24000, { gain: 3 });
    expect(Math.max(...result)).toBeLessThanOrEqual(Math.ceil(0.95 * 32767));
    expect(Math.min(...result)).toBeGreaterThanOrEqual(
      -Math.ceil(0.95 * 32767),
    );
    expect(result[30]).toBeGreaterThan(0);
  });
  it("keeps silence silent and rejects invalid gain", () => {
    expect(masterPcm(new Int16Array(24000), 24000).every((v) => v === 0)).toBe(
      true,
    );
    expect(() => masterPcm(tone(), 24000, { gain: Infinity })).toThrow();
    expect(() => masterPcm(tone(), 24000, { gain: 4 })).toThrow();
  });
  it("exposes the requested editable Jon and Emily suggestions for every picker", () => {
    expect(voices.find((v) => v.id === "parler:Jon")?.delivery.emotion).toBe(
      "Excited",
    );
    expect(voices.find((v) => v.id === "parler:Emily")?.delivery.emotion).toBe(
      "Calm",
    );
    expect(
      voices.every((v) => v.delivery.label && v.delivery.description),
    ).toBe(true);
  });
  it("bounds output volume and invalidates stale recordings when it changes", () => {
    const original = inputSchema.parse({
      text: "Hello.",
      voice: "kokoro:af_heart",
    });
    expect(original.normalizeAudio).toBe(true);
    expect(original.outputGain).toBe(1);
    expect(
      inputSchema.safeParse({ ...original, outputGain: 3.1 }).success,
    ).toBe(false);
    expect(synthesisKey({ ...original, outputGain: 2 })).not.toBe(
      synthesisKey(original),
    );
  });
});
