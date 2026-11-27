import { authenticated, error, rateLimit, sameOrigin } from "@/lib/auth";
import { validateReferenceWav } from "@/lib/clone";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 310;
const schema = z.object({
  audio: z.string().min(1).max(640100).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  language: z.enum(["bn", "en"]), consent: z.literal(true),
});
let busy = false;
export async function POST(request: Request) {
  if (!(await authenticated())) return error("Please sign in.", 401);
  if (!sameOrigin(request)) return error("Origin not allowed.", 403);
  if (!rateLimit("clone-transcribe", 6)) return error("Please wait before transcribing again.", 429);
  if (Number(request.headers.get("content-length") ?? 0) > 700000) return error("Request too large.", 413);
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 700000) return error("Request too large.", 413);
    input = schema.parse(JSON.parse(raw));
    validateReferenceWav(Buffer.from(input.audio, "base64"));
  } catch {
    return error("Choose 3–10 seconds of audible speech and confirm permission first.");
  }
  try { await access(path.join(process.cwd(), ".models/whisper/model.bin")); }
  catch { return error("Install free transcription with scripts/setup-transcription.ps1, or type the exact words below.", 503); }
  if (busy) return error("Transcription is busy. Please wait.", 429);
  busy = true;
  try {
    const text = await new Promise<string>((resolve, reject) => {
      const python = path.join(process.cwd(), ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
      const child = spawn(python, ["-m", "neural.transcribe_worker"], { cwd: process.cwd(), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
      let output = Buffer.alloc(0), stderr = "";
      const timer = setTimeout(() => { child.kill(); reject(new Error("Transcription timed out. Type the selected words or try another clip.")); }, 300000);
      child.stdout.on("data", (b: Buffer) => {
        output = Buffer.concat([output, b]);
        if (output.length > 16000) { child.kill(); reject(new Error("Invalid transcription output.")); }
      });
      child.stderr.on("data", (b) => { stderr = (stderr + b.toString()).slice(-3000); });
      child.on("error", (e) => { clearTimeout(timer); reject(e); });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          console.error("Local transcription:", stderr);
          reject(new Error("Could not transcribe this clip. Try another selection or type the exact words."));
        } else {
          try { resolve(z.object({ text: z.string().min(2).max(1000) }).parse(JSON.parse(output.toString("utf8"))).text); }
          catch { reject(new Error("No clear speech detected. Type the exact words.")); }
        }
      });
      child.stdin.on("error", () => {});
      child.stdin.end(JSON.stringify(input));
    });
    return Response.json({ text }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return error(e instanceof Error ? e.message : "Transcription failed.", 503); }
  finally { busy = false; }
}
