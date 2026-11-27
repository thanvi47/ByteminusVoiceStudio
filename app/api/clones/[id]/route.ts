import { authenticated, error, sameOrigin } from "@/lib/auth";
import { deleteClone, profileFolder } from "@/lib/clone-store";
import { readFile } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, ctx: Context) {
  if (!(await authenticated())) return error("Please sign in.", 401);
  try {
    return new Response(
      new Uint8Array(
        await readFile(
          path.join(profileFolder((await ctx.params).id), "reference.wav"),
        ),
      ),
      { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } },
    );
  } catch {
    return error("Voice not found.", 404);
  }
}
export async function DELETE(request: Request, ctx: Context) {
  if (!(await authenticated())) return error("Please sign in.", 401);
  if (!sameOrigin(request)) return error("Origin not allowed.", 403);
  try {
    await deleteClone((await ctx.params).id);
    return Response.json({ deleted: true });
  } catch {
    return error("Invalid voice.");
  }
}
