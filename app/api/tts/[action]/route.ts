import { authenticated, error, rateLimit, sameOrigin } from "@/lib/auth";
import { inputSchema, parseScript, voices } from "@/lib/script";
import { provider, usage, neuralStatus } from "@/lib/tts";
import { ZodError } from "zod";
import { createJob, getJob, cancelJob, validJobId, throwIfCancelled } from "@/lib/generation-jobs";
export const runtime = "nodejs";
export const maxDuration = 14400;
export async function GET(
  request: Request,
  ctx: { params: Promise<{ action: string }> },
) {
  if (!(await authenticated())) return error("Please sign in.", 401);
  const { action } = await ctx.params;
  if (action === "progress") {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!validJobId(id)) return error("Invalid generation ID.", 400);
    const job = getJob(id);
    return job ? Response.json(job, { headers: { "Cache-Control": "no-store" } }) : error("Generation not found.", 404);
  }
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
  const { action } = await ctx.params;
  if (action === "cancel") {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    if (!validJobId(id)) return error("Invalid generation ID.", 400);
    const job = await cancelJob(id);
    return job ? Response.json(job) : error("Generation not found.", 404);
  }
  if (action !== "generate") return error("Not found.", 404);
  if (!rateLimit("synthesis", 12))
    return error("Please wait a minute before generating again.", 429);
  if (Number(request.headers.get("content-length") ?? 0) > 80000)
    return error("Request too large.", 413);
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 80000) return error("Request too large.", 413);
    input = inputSchema.parse(JSON.parse(raw));
    parseScript(input.text);
    if (input.text.length > 3000) {
      const status = await neuralStatus();
      const hardware = status.engineHardware?.[input.voice.split(":")[0]] ?? status.hardware;
      const limit = Math.min(12000, hardware?.maxScriptCharacters ?? 3000);
      if (input.text.length > limit) return error(`This runtime supports ${limit.toLocaleString()} script characters. Use a shorter section or a compatible CUDA GPU.`, 400);
    }
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
  const id = request.headers.get("X-Generation-ID") ?? crypto.randomUUID();
  if (!validJobId(id)) return error("Invalid generation ID.", 400);
  let control;
  try { control = createJob(id); } catch { return error("Generation ID already used or studio busy.", 409); }
  const abort = () => { void cancelJob(id); };
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  try {
    const { audio, duration, peaks } = await provider.synthesize(input, control);
    throwIfCancelled(control);
    control.update({ status: "complete", percent: 100, stage: "Audio ready." });
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
    if (control.signal.aborted || (e instanceof Error && e.message === "GENERATION_CANCELLED")) {
      control.update({ status: "cancelled", stage: "Generation cancelled." });
      return error("Generation cancelled.", 499);
    }
    control.update({ status: "failed", stage: "Generation failed." });
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
    if (e instanceof Error && e.message === "NEURAL_TIMEOUT")
      return error("CPU generation exceeded the waiting limit. Try a shorter script; the voice server may still be available.", 504);
    if (e instanceof Error && e.message === "NEURAL_CONNECTION")
      return error("The voice connection closed before generation finished. Check the local server log and retry with a shorter script.", 503);
    if (e instanceof Error && e.message.startsWith("NEURAL: "))
      return error(e.message.slice(8), 503);
    return error(
      e instanceof Error && e.message === "BUSY"
        ? "Studio is busy. Retry in a few seconds."
        : "Speech generation failed. Please retry.",
      503,
    );
  } finally { request.signal.removeEventListener("abort", abort); }
}
