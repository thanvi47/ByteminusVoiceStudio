import { describe, expect, it } from "vitest";
import { cloneFormIssues } from "../lib/clone-form";
describe("clone form feedback", () => {
  const ready = { hasAudio: true, validRange: true, name: "Mine", transcript: "Hello there.", consent: true };
  it("explains the single-letter transcript failure from the reported screenshot", () => {
    const issues = cloneFormIssues({ ...ready, transcript: "a" });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("Auto transcribe");
    expect(issues[0]).toContain("‘a’");
  });
  it("lists missing recording, name, transcript and permission together", () => {
    expect(cloneFormIssues({ hasAudio: false, validRange: false, name: " ", transcript: " ", consent: false })).toHaveLength(4);
  });
  it("requires an in-bounds reference even with a transcript", () => {
    expect(cloneFormIssues({ ...ready, validRange: false })[0]).toContain("3–10");
  });
  it("accepts complete Bengali and English forms", () => {
    expect(cloneFormIssues(ready)).toEqual([]);
    expect(cloneFormIssues({ ...ready, transcript: "আমি বাংলা বলি।" })).toEqual([]);
  });
});
