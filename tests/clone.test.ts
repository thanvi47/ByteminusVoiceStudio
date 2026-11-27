import { describe, expect, it } from "vitest";
import {
  cloneCreateSchema,
  cloneGenerateSchema,
  validateReferenceWav,
} from "../lib/clone";
import { wav } from "../lib/tts";

function reference(seconds = 4) {
  const pcm = new Int16Array(seconds * 24000);
  for (let i = 0; i < pcm.length; i++)
    pcm[i] = Math.round(Math.sin(i * 0.12) * 5000);
  return wav(pcm, 24000);
}
describe("private clone reference validation", () => {
  it("accepts the exact mono 24kHz PCM upload format", () =>
    expect(validateReferenceWav(reference())).toBe(4));
  it.each([2, 11])("rejects a %i second selection", (seconds) =>
    expect(() => validateReferenceWav(reference(seconds))).toThrow("3 and 10"),
  );
  it("rejects silence", () =>
    expect(() =>
      validateReferenceWav(wav(new Int16Array(96000), 24000)),
    ).toThrow("silent"));
  it("rejects truncated audio and disguised formats", () => {
    const b = reference();
    expect(() => validateReferenceWav(b.subarray(0, -2))).toThrow();
    b.writeUInt16LE(2, 22);
    expect(() => validateReferenceWav(b)).toThrow();
  });
  it("requires consent before saving a voice", () =>
    expect(
      cloneCreateSchema.safeParse({
        name: "Mine",
        transcript: "Hello there.",
        audio: "abc",
        consent: false,
      }).success,
    ).toBe(false));
  it("rejects filesystem paths as profile identifiers", () =>
    expect(
      cloneGenerateSchema.safeParse({
        id: "../../private",
        text: "Hello",
        language: "en",
        format: "wav",
      }).success,
    ).toBe(false));
  it("bounds cloned scripts and languages", () => {
    const base = {
      id: "fd7a2d09-504d-4f09-b510-4f7c8d4c8fa0",
      text: "আমি বাংলা বলি।",
      language: "bn",
      format: "wav",
    };
    expect(cloneGenerateSchema.safeParse(base).success).toBe(true);
    expect(
      cloneGenerateSchema.safeParse({ ...base, text: "a".repeat(601) }).success,
    ).toBe(false);
    expect(
      cloneGenerateSchema.safeParse({ ...base, language: "other" }).success,
    ).toBe(false);
  });
});
