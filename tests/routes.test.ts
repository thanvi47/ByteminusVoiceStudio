import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const { jar } = vi.hoisted(() => ({ jar: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => jar.set(k, v),
    delete: (k: string) => jar.delete(k),
  }),
}));
import { GET as session, POST as auth } from "../app/api/auth/[action]/route";
import { GET, POST } from "../app/api/tts/[action]/route";
import { GET as health } from "../app/api/health/route";
const ctx = (action: string) => ({ params: Promise.resolve({ action }) });
const req = (path: string, body: unknown) =>
  new Request(`http://localhost:3000/api/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ACCESS_PASSWORD", "test-only-password");
  vi.stubEnv("SESSION_SECRET", "s".repeat(32));
  jar.clear();
});
afterEach(() => vi.unstubAllEnvs());
describe("API routes", () => {
  it("protects every TTS endpoint", async () => {
    expect((await GET(req("tts/voices", {}), ctx("voices"))).status).toBe(401);
    expect((await GET(req("tts/usage", {}), ctx("usage"))).status).toBe(401);
    expect(
      (
        await POST(
          req("tts/generate", { text: "Hi", voice: "bn" }),
          ctx("generate"),
        )
      ).status,
    ).toBe(401);
  });
  it("logs in, creates a real WAV, reports voices and logs out", async () => {
    expect(
      (await auth(req("auth/login", { password: "wrong" }), ctx("login")))
        .status,
    ).toBe(401);
    expect(
      (
        await auth(
          req("auth/login", { password: "test-only-password" }),
          ctx("login"),
        )
      ).status,
    ).toBe(200);
    expect((await (await session()).json()).authenticated).toBe(true);
    const catalog = await GET(req("tts/voices", {}), ctx("voices"));
    expect((await catalog.json()).voices).toHaveLength(6);
    const audio = await POST(
      req("tts/generate", { text: "Hello API.", voice: "en-us" }),
      ctx("generate"),
    );
    expect(audio.status).toBe(200);
    expect(audio.headers.get("content-type")).toBe("audio/wav");
    expect(Buffer.from(await audio.arrayBuffer()).toString("ascii", 0, 4)).toBe(
      "RIFF",
    );
    expect((await auth(req("auth/logout", {}), ctx("logout"))).status).toBe(
      200,
    );
    expect((await (await session()).json()).authenticated).toBe(false);
  });
  it("rejects invalid synthesis JSON and markup controls", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ACCESS_PASSWORD", "");
    expect(
      (
        await POST(
          req("tts/generate", { text: "Hi [break 12s]", voice: "bn" }),
          ctx("generate"),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await POST(
          req("tts/generate", { text: "", voice: "fake" }),
          ctx("generate"),
        )
      ).status,
    ).toBe(400);
    const r = await POST(
      req("tts/generate", { text: "Hello", voice: "en-us", format: "mp3" }),
      ctx("generate"),
    );
    expect(r.headers.get("content-type")).toBe("audio/mpeg");
  });
  it("returns safe configuration failure", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    expect((await health()).status).toBe(503);
    expect(
      (
        await auth(
          req("auth/login", { password: "test-only-password" }),
          ctx("login"),
        )
      ).status,
    ).toBe(503);
  });
});
