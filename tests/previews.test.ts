import { describe, it, expect } from "vitest";
import { previewManifestSchema } from "../lib/previews";
describe("saved sample manifest", () => {
  it("accepts versioned local audio assets", () =>
    expect(
      previewManifestSchema.safeParse({
        version: 1,
        mode: "neutral",
        samples: {
          "mithi:charvi": {
            url: "/voice-previews/v1/mithi-charvi.abcdef123456.mp3",
            text: "Generic sample.",
            duration: 3,
          },
        },
      }).success,
    ).toBe(true));
  it.each([
    "https://external.example/sample.mp3",
    "javascript:alert(1)",
    "/voice-previews/v1/../../private.mp3",
  ])("rejects unexpected sample location %s", (url) =>
    expect(
      previewManifestSchema.safeParse({
        version: 1,
        mode: "neutral",
        samples: { voice: { url, text: "Generic", duration: 3 } },
      }).success,
    ).toBe(false),
  );
  it("rejects empty sample duration", () =>
    expect(
      previewManifestSchema.safeParse({
        version: 1,
        mode: "neutral",
        samples: {
          voice: {
            url: "/voice-previews/v1/mithi-charvi.abcdef123456.mp3",
            text: "Generic",
            duration: 0,
          },
        },
      }).success,
    ).toBe(false));
});
