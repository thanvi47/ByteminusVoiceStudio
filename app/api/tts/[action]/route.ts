import { authenticated, error, rateLimit, sameOrigin } from "@/lib/auth";
import { inputSchema, parseScript, voices } from "@/lib/script";
import { provider, usage, neuralStatus } from "@/lib/tts";
import { ZodError } from "zod";
export const runtime = "nodejs";
export const maxDuration = 800;
export async function GET(
  _: Request,
  ctx: { params: Promise<{ action: string }> },
) {
  if (!(await authenticated())) return error("Please sign in.", 401);
  const { action } = await ctx.params;
  if (action === "voices")
    return Response.json(
      {
        voices,
        capabilities: provider.getCapabilities(),
        neural: await neuralStatus(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  if (action === "usage")
    return Response.json(
      {
        ...usage,
        scope: "Current server process only; resets on restart.",
        quota: null,
        provider: "Local neural studio",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  return error("Not found.", 404);
}
export async function POST(
  request: Request,
  ctx: { params: Promise<{ action: string }> },
) {
  if (!(await authenticated())) return error("Please sign in.", 401);
  if (!sameOrigin(request)) return error("Origin not allowed.", 403);
  if ((await ctx.params).action !== "generate") return error("Not found.", 404);
  if (!rateLimit("synthesis", 12))
    return error("Please wait a minute before generating again.", 429);
  if (Number(request.headers.get("content-length") ?? 0) > 20000)
    return error("Request too large.", 413);
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 20000) return error("Request too large.", 413);
    input = inputSchema.parse(JSON.parse(raw));
    parseScript(input.text);
  } catch (e) {
    if (e instanceof ZodError)
      return error(e.issues[0]?.message ?? "Invalid synthesis input.");
    return error(
      e instanceof Error && e.message.startsWith("[")
        ? "Check text length, voice and delivery settings."
        : e instanceof Error
          ? e.message
          : "Invalid request.",
    );
  }
  try {
    const { audio, duration, peaks } = await provider.synthesize(input);
    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": input.format === "wav" ? "audio/wav" : "audio/mpeg",
        "Content-Disposition": `attachment; filename="byteminus-voice.${input.format}"`,
        "Cache-Control": "no-store",
        "X-Audio-Duration": duration.toFixed(3),
        "X-Audio-Peaks": JSON.stringify(peaks.map((p) => +p.toFixed(3))),
      },
    });
  } catch (e) {
    console.error(
      "Synthesis failed:",
      e instanceof Error ? e.message : "unknown",
    );
    if (e instanceof Error && e.message === "AUDIO_LIMIT")
      return error("Audio exceeds 90 seconds. Generate shorter sections.", 413);
    if (e instanceof Error && e.message === "NEURAL_OFFLINE")
      return error(
        "Local neural server is unavailable. Start the studio with npm run dev:studio. No robotic fallback was used.",
        503,
      );
    if (e instanceof Error && e.message.startsWith("NEURAL: "))
      return error(e.message.slice(8), 503);
    return error(
      e instanceof Error && e.message === "BUSY"
        ? "Studio is busy. Retry in a few seconds."
        : "Speech generation failed. Please retry.",
      503,
    );
  }
}
