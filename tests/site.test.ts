import { describe, it, expect } from "vitest";
import { siteSettings } from "../lib/site";
describe("public SEO configuration", () => {
  it("keeps unconfigured and private local workspaces out of search indexes", () => {
    for (const url of [undefined, "http://localhost:3000", "https://127.0.0.1", "https://192.168.1.4", "https://voice.local", "https://secret:password@example.com"])
      expect(siteSettings(url, "true").index).toBe(false);
  });
  it("requires explicit indexing opt-in and emits a canonical public origin", () => {
    expect(siteSettings("https://voice.example.org/", "false").index).toBe(false);
    const settings = siteSettings("https://voice.example.org/?tracking=1", "true");
    expect(settings.index).toBe(true);
    expect(settings.url?.href).toBe("https://voice.example.org/");
  });
});
