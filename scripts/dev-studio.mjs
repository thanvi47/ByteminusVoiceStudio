import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
const root = process.cwd();
const version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
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
  const status = await r.json();
  if (status.runtimeVersion !== version) {
    console.error("An older neural server is still running. Stop the studio, run ./scripts/stop-neural.ps1 on Windows, then start npm run dev again.");
    process.exit(1);
  }
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
  for (const child of children) {
    if (process.platform === "win32" && child.pid) {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    } else child.kill();
  }
  process.exit();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
