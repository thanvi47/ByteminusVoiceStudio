import { authenticated, error, rateLimit, sameOrigin } from "@/lib/auth";
import { cloneCreateSchema } from "@/lib/clone";
import { listClones, saveClone } from "@/lib/clone-store";
import { access } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
export async function GET() {
  if (!(await authenticated())) return error("Please sign in.", 401);
  let installed = false;
  try {
    await access(
      path.join(process.cwd(), ".models/omnivoice/model.safetensors"),
    );
    installed = true;
  } catch {}
  return Response.json(
    { profiles: await listClones(), installed },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(request: Request) {
  if (!(await authenticated())) return error("Please sign in.", 401);
  if (!sameOrigin(request)) return error("Origin not allowed.", 403);
  if (!rateLimit("clone-upload", 10))
    return error("Please wait before saving another voice.", 429);
  if (Number(request.headers.get("content-length") ?? 0) > 700000)
    return error("Reference too large.", 413);
  try {
    const raw = await request.text();
    if (raw.length > 700000) return error("Reference too large.", 413);
    const data = cloneCreateSchema.parse(JSON.parse(raw));
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data.audio))
      return error("Invalid audio encoding.");
    return Response.json(
      await saveClone(
        data.name,
        data.transcript,
        Buffer.from(data.audio, "base64"),
      ),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return error(
      e instanceof Error && !e.message.startsWith("[")
        ? e.message
        : "Check the voice name, transcript and consent.",
    );
  }
}
