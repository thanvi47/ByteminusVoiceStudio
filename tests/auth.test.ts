import { afterEach, describe, it, expect, vi } from "vitest";
import {
  configured,
  localMode,
  makeSession,
  validSession,
  rateLimit,
  sameOrigin,
} from "../lib/auth";
afterEach(() => vi.unstubAllEnvs());
describe("authentication", () => {
  it("fails closed in production without configuration", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ACCESS_PASSWORD", "");
    vi.stubEnv("SESSION_SECRET", "");
    expect(configured()).toBe(false);
    expect(localMode()).toBe(false);
    expect(validSession("")).toBe(false);
  });
  it("verifies signed sessions and rejects tampering and expiry", () => {
    vi.stubEnv("APP_ACCESS_PASSWORD", "test");
    vi.stubEnv("SESSION_SECRET", "x".repeat(32));
    const token = makeSession();
    expect(validSession(token)).toBe(true);
    expect(validSession(token + "x")).toBe(false);
    expect(validSession("0." + token.split(".").slice(1).join("."))).toBe(
      false,
    );
  });
  it("limits repeated requests", () => {
    const key = crypto.randomUUID();
    expect(rateLimit(key, 1)).toBe(true);
    expect(rateLimit(key, 1)).toBe(false);
  });
  it("rejects cross-origin writes", () =>
    expect(
      sameOrigin(
        new Request("http://localhost:3000/api/tts/generate", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toBe(false));
  it("accepts the actual host when Next normalizes a loopback URL", () =>
    expect(
      sameOrigin(
        new Request("http://localhost:3000/api/tts/generate", {
          headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" },
        }),
      ),
    ).toBe(true));
});
