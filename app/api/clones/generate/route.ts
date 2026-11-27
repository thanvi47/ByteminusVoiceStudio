import { authenticated, error, rateLimit, sameOrigin } from "@/lib/auth";
import { cloneGenerateSchema } from "@/lib/clone";
import { profileFolder } from "@/lib/clone-store";
import { encode } from "@/lib/tts";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
export const maxDuration = 1000;
let busy = false;
export async function POST(request: Request) {
  if (!(await authenticated())) return error("Please sign in.", 401);
  if (!sameOrigin(request)) return error("Origin not allowed.", 403);
  if (!rateLimit("clone-generate", 6))
    return error("Please wait before generating again.", 429);
  if (Number(request.headers.get("content-length") ?? 0) > 10000)
    return error("Request too large.", 413);
  if (busy)
    return error(
      "Voice cloning is busy. Wait for the current generation.",
      429,
    );
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 10000) return error("Request too large.", 413);
    input = cloneGenerateSchema.parse(JSON.parse(raw));
    await access(path.join(profileFolder(input.id), "profile.json"));
  } catch {
    return error("Select a saved voice and enter 2–600 characters.");
  }
  try {
    await access(
      path.join(
        process.cwd(),
        ".models/omnivoice/audio_tokenizer/model.safetensors",
      ),
    );
  } catch {
    return error(
      "Install the free cloning model with scripts/setup-cloning.ps1 first.",
      503,
    );
  }
  // Recheck after asynchronous validation so two simultaneous requests cannot both start a model.
  if (busy)
    return error(
      "Voice cloning is busy. Wait for the current generation.",
      429,
    );
  busy = true;
  try {
    const data = await new Promise<Buffer>((resolve, reject) => {
      const python = path.join(
        process.cwd(),
        ".venv",
        process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
      );
      const child = spawn(python, ["-m", "neural.clone_worker"], {
        cwd: process.cwd(),
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      const chunks: Buffer[] = [];
      let size = 0;
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("Cloning timed out. Try a shorter script."));
      }, 900000);
      child.stdout.on("data", (b: Buffer) => {
        size += b.length;
        if (size > 90 * 24000 * 2) {
          child.kill();
          reject(new Error("Output exceeds 90 seconds."));
        } else chunks.push(b);
      });
      child.stderr.on("data", (b) => {
        stderr = (stderr + b.toString()).slice(-3000);
      });
      child.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          console.error("Local cloning:", stderr);
          reject(new Error("Cloning failed. Check the local server log."));
        } else resolve(Buffer.concat(chunks));
      });
      child.stdin.on("error", () => {});
      child.stdin.end(JSON.stringify(input));
    });
    if (!data.length || data.length % 2)
      throw new Error("No valid audio generated.");
    const pcm = new Int16Array(data.length / 2);
    for (let i = 0; i < pcm.length; i++) pcm[i] = data.readInt16LE(i * 2);
    return new Response(new Uint8Array(encode(pcm, 24000, input.format)), {
      headers: {
        "Content-Type": input.format === "wav" ? "audio/wav" : "audio/mpeg",
        "X-Audio-Duration": String(pcm.length / 24000),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return error(e instanceof Error ? e.message : "Cloning failed.", 503);
  } finally {
    busy = false;
  }
}
