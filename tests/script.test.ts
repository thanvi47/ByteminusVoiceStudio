import { describe, it, expect } from "vitest";
import {
  emotions,
  detectLanguage,
  delivery,
  escapeXML,
  inputSchema,
  parseScript,
  srt,
  synthesisKey,
} from "../lib/script";
describe("scripts", () => {
  it("invalidates an old recording when any synthesis setting changes", () => {
    const original = inputSchema.parse({
      text: "Hello there.",
      voice: "parler:Jon",
    });
    for (const changed of [
      { emotion: "Funny" },
      { intensity: 90 },
      { rate: 0.75 },
      { pitch: 1.3 },
      { style: "whisper" },
      { voice: "parler:Lea" },
      { text: "New words." },
      { format: "mp3" },
    ]) {
      expect(
        synthesisKey(inputSchema.parse({ ...original, ...changed })),
      ).not.toBe(synthesisKey(original));
    }
    expect(synthesisKey({ ...original })).toBe(synthesisKey(original));
  });
  it("provides delivery settings for every non-neutral preset", () => {
    for (const emotion of emotions.filter((e) => e !== "Neutral")) {
      expect(delivery(emotion, 100)).not.toEqual({ rate: 1, pitch: 1 });
    }
  });
  it("detects Bengali and English", () => {
    expect(detectLanguage("আমি বাংলা বলি")).toBe("bn");
    expect(detectLanguage("Hello")).toBe("en-US");
  });
  it("escapes user markup", () =>
    expect(escapeXML('<speak a="x">&\'</speak>')).toBe(
      "&lt;speak a=&quot;x&quot;&gt;&amp;&apos;&lt;/speak&gt;",
    ));
  it("parses pauses without speaking tags", () =>
    expect(parseScript("Hello [pause 500ms] world [break 1.5s]")).toEqual([
      { text: "Hello " },
      { pause: 0.5 },
      { text: " world " },
      { pause: 1.5 },
    ]));
  it.each([
    "Hi [pause 11s]",
    "Hi [break abc]",
    "Hi [pause 2]",
    "Hi [pause nope",
    "[pause 1s]",
  ])("rejects invalid breaks: %s", (text) =>
    expect(() => parseScript(text)).toThrow(),
  );
  it("bounds total pauses", () =>
    expect(() => parseScript("Hi " + "[pause 1s]".repeat(31))).toThrow());
  it("validates text, voice and delivery", () => {
    expect(inputSchema.safeParse({ text: "Hi", voice: "bn" }).success).toBe(
      true,
    );
    for (const data of [
      { text: "", voice: "bn" },
      { text: "x".repeat(3001), voice: "bn" },
      { text: "Hi", voice: "fake" },
      { text: "Hi", voice: "bn", rate: 5 },
    ])
      expect(inputSchema.safeParse(data).success).toBe(false);
  });
  it("maps approximated delivery with intensity", () => {
    expect(
      inputSchema.safeParse({
        text: "A funny story.",
        voice: "parler:Jon",
        emotion: "Funny",
      }).success,
    ).toBe(true);
    expect(delivery("Funny", 100).pitch).toBeGreaterThan(1);
    expect(delivery("Happy", 0)).toEqual({ rate: 1, pitch: 1 });
    expect(delivery("Happy", 100).rate).toBeGreaterThan(1);
    expect(delivery("Calm", 100).rate).toBeLessThan(1);
  });
  it("exports estimated sentence timings without tags", () => {
    const output = srt("Hello. [pause 500ms] World!", 4);
    expect(output).toContain("00:00:00,000");
    expect(output).toContain("00:00:04,000");
    expect(output).not.toContain("[pause");
  });
});
