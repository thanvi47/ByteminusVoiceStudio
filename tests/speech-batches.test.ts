import { describe, it, expect } from "vitest";
import { speechBatches } from "../lib/speech-batches";
import { inputSchema } from "../lib/script";

describe("long script batches", () => {
  it("accepts expressive scripts above the former 600-character CPU limit", () => {
    expect(inputSchema.safeParse({ text: "Hello world. ".repeat(70), voice: "parler:Lea" }).success).toBe(true);
  });
  it("keeps Bengali words and pauses in order without breaking a pause tag", () => {
    const text = ("আজ একটি সুন্দর দিন। [pause 500ms] " + "আমি নতুন গল্প বলছি। ").repeat(15);
    const batches = speechBatches(text, 160);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.every((s) => s.length <= 160)).toBe(true);
    expect(batches.join(" ").replaceAll("[pause 0.5s]", "[pause 500ms]")).toBe(text.trim().replace(/\s+/gu, " "));
  });
  it("uses fewer batches for a larger GPU budget", () => {
    const text = "A wonderful day. ".repeat(100);
    expect(speechBatches(text, 1200).length).toBeLessThan(speechBatches(text, 160).length);
  });
});
