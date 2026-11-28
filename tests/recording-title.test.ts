import { describe, expect, it } from "vitest";
import { recordingTitle } from "../lib/recording-title";
describe("recording titles", () => {
  it("uses the first six words and an English suffix", () => {
    expect(recordingTitle("A warm voice tells our story with care.")).toBe("A warm voice tells our story en");
  });
  it("keeps Bengali letters and vowel marks with a bn suffix", () => {
    expect(recordingTitle("আজ একটি নতুন দিন। আমরা গল্প শুনব।")).toBe("আজ একটি নতুন দিন আমরা গল্প bn");
  });
  it("removes pause directives and unsafe filename punctuation", () => {
    expect(recordingTitle('[pause 500ms] Hello: a / new \\ story?')).toBe("Hello a new story en");
  });
});
