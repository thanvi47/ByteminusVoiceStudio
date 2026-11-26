import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
export const cookieName = "byteminus_session";
export function configured() {
  return Boolean(
    process.env.APP_ACCESS_PASSWORD &&
    (process.env.SESSION_SECRET?.length ?? 0) >= 32,
  );
}
export function localMode() {
  return (
    process.env.NODE_ENV !== "production" && !process.env.APP_ACCESS_PASSWORD
  );
}
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function sign(payload: string) {
  return createHmac("sha256", process.env.SESSION_SECRET ?? "")
    .update(payload)
    .digest("hex");
}
export function makeSession() {
  const payload = `${Date.now() + 86400000}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${sign(payload)}`;
}
export function validSession(value: string) {
  if (!configured()) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  return (
    Number(parts[0]) > Date.now() &&
    equal(parts[2], sign(parts.slice(0, 2).join(".")))
  );
}
export async function authenticated() {
  return (
    localMode() || validSession((await cookies()).get(cookieName)?.value ?? "")
  );
}
const buckets = new Map<string, { count: number; expires: number }>();
// Single-process limiter: use a single instance behind a trusted reverse proxy.
export function rateLimit(key: string, max: number, window = 60000) {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.expires < now) buckets.delete(k);
  const b = buckets.get(key) ?? { count: 0, expires: now + window };
  b.count++;
  buckets.set(key, b);
  return b.count <= max;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const supplied = new URL(origin);
    const url = new URL(request.url);
    return (
      origin === url.origin ||
      (supplied.host === request.headers.get("host") &&
        supplied.protocol === url.protocol)
    );
  } catch {
    return false;
  }
}
export function error(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}
