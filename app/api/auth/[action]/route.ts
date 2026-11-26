import { cookies } from "next/headers";
import {
  authenticated,
  configured,
  cookieName,
  equal,
  error,
  localMode,
  makeSession,
  rateLimit,
  sameOrigin,
} from "@/lib/auth";
export async function GET() {
  return Response.json(
    {
      authenticated: await authenticated(),
      localMode: localMode(),
      configured: configured(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(
  request: Request,
  ctx: { params: Promise<{ action: string }> },
) {
  if (!sameOrigin(request)) return error("Origin not allowed.", 403);
  const { action } = await ctx.params;
  if (action === "logout") {
    (await cookies()).delete(cookieName);
    return Response.json({ ok: true });
  }
  if (action !== "login") return error("Not found.", 404);
  if (!rateLimit("login", 10, 60000))
    return error("Too many attempts. Wait one minute.", 429);
  if (!configured())
    return error(
      "Set APP_ACCESS_PASSWORD and a SESSION_SECRET of at least 32 characters.",
      503,
    );
  if (Number(request.headers.get("content-length") ?? 0) > 2048)
    return error("Request too large.", 413);
  let body;
  try {
    body = await request.text();
    if (body.length > 2048) return error("Request too large.", 413);
    body = JSON.parse(body);
  } catch {
    return error("Invalid JSON.");
  }
  if (
    typeof body.password !== "string" ||
    !equal(body.password, process.env.APP_ACCESS_PASSWORD!)
  )
    return error("Incorrect password.", 401);
  (await cookies()).set(cookieName, makeSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });
  return Response.json({ ok: true });
}
