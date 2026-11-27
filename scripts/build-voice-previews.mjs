import { spawn } from "node:child_process";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { Mp3Encoder } from "@breezystack/lamejs";
import { masterPcm } from "../lib/audio-levels.mjs";
const root = process.cwd();
const catalog = JSON.parse(
  await readFile("lib/voice-catalog.json", "utf8"),
).filter((v) => ["mithi", "kokoro", "parler"].includes(v.engine));
const folder = "public/voice-previews/v1";
await mkdir(folder, { recursive: true });
const python = (env) =>
  path.join(
    root,
    env,
    process.platform === "win32" ? "Scripts/python.exe" : "bin/python",
  );
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Preview generation exited ${code}`)),
    );
  });
}
function readWav(buffer) {
  if (
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  )
    throw new Error("Invalid sample WAV");
  let sampleRate = 0,
    pcm;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString("ascii", offset, offset + 4),
      size = buffer.readUInt32LE(offset + 4),
      start = offset + 8;
    if (start + size > buffer.length) throw new Error("Truncated WAV");
    if (id === "fmt ") {
      if (
        buffer.readUInt16LE(start) !== 1 ||
        buffer.readUInt16LE(start + 2) !== 1 ||
        buffer.readUInt16LE(start + 14) !== 16
      )
        throw new Error("Expected mono PCM16");
      sampleRate = buffer.readUInt32LE(start + 4);
    }
    if (id === "data") {
      pcm = new Int16Array(size / 2);
      for (let i = 0; i < pcm.length; i++)
        pcm[i] = buffer.readInt16LE(start + i * 2);
    }
    offset = start + size + (size % 2);
  }
  if (!pcm?.length || !sampleRate) throw new Error("Empty preview");
  return { pcm, sampleRate };
}
const manifest = { version: 1, mode: "neutral", samples: {} };
async function publish() {
  for (const voice of catalog) {
    const base = voice.id.replace(/[^A-Za-z0-9_-]/g, "-");
    const source = path.join(".cache/preview-pcm/v1", base + ".wav");
    try {
      await access(source);
    } catch {
      continue;
    }
    const { pcm, sampleRate } = readWav(await readFile(source));
    pcm.set(masterPcm(pcm, sampleRate));
    const encoder = new Mp3Encoder(1, sampleRate, 96);
    const chunks = [];
    for (let i = 0; i < pcm.length; i += 1152)
      chunks.push(Buffer.from(encoder.encodeBuffer(pcm.subarray(i, i + 1152))));
    chunks.push(Buffer.from(encoder.flush()));
    const audio = Buffer.concat(chunks);
    const hash = createHash("sha256").update(audio).digest("hex").slice(0, 12);
    const filename = `${base}.${hash}.mp3`;
    await writeFile(path.join(folder, filename), audio);
    manifest.samples[voice.id] = {
      url: `/voice-previews/v1/${filename}`,
      duration: pcm.length / sampleRate,
      text:
        voice.language === "bn"
          ? "হ্যালো! চলুন, আপনার গল্পকে কণ্ঠ দিই।"
          : "Hello! Let's bring your story to life.",
    };
  }
  await writeFile(
    path.join(folder, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(
    `${Object.keys(manifest.samples).length}/${catalog.length} persistent previews ready.`,
  );
}
await publish();
for (const engine of process.argv.includes("--publish-only")
  ? []
  : ["mithi", "kokoro", "parler"]) {
  await run(python(engine === "parler" ? ".runtime/parler-env" : ".venv"), [
    "-m",
    "neural.build_previews",
    engine,
  ]);
  await publish();
}
if (Object.keys(manifest.samples).length !== catalog.length)
  throw new Error("Some speaker samples are missing.");
