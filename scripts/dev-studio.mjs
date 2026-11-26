import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
const root = process.cwd();
const mode = process.argv.includes("--production") ? "start" : "dev";
const python =
  process.platform === "win32"
    ? ".venv/Scripts/python.exe"
    : ".venv/bin/python";
const children = [];
function run(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  child.on("error", (e) => console.error(e.message));
  return child;
}
if (!existsSync(python)) {
  console.error("Neural Python environment is missing. Follow docs/NEURAL.md.");
  process.exit(1);
}
try {
  const r = await fetch("http://127.0.0.1:8123/health", {
    signal: AbortSignal.timeout(1000),
  });
  if (!r.ok) throw new Error();
  console.log("Using existing local neural server.");
} catch {
  run(path.resolve(python), [
    "-m",
    "uvicorn",
    "neural.server:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8123",
  ]);
}
try {
  const r = await fetch("http://127.0.0.1:3000/api/health", {
    signal: AbortSignal.timeout(2000),
  });
  if (!r.ok) throw new Error();
  console.log("Using existing Next.js server: http://127.0.0.1:3000");
} catch {
  run(process.execPath, [
    "node_modules/next/dist/bin/next",
    mode,
    "--hostname",
    "127.0.0.1",
  ]);
}
function shutdown() {
  for (const child of children) child.kill();
  process.exit();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
