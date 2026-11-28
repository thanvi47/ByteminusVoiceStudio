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
if (!existsSync(path.join(root, "node_modules/next/dist/bin/next"))) {
  console.error("Web packages are missing. In this folder, run npm ci --legacy-peer-deps and wait for it to succeed before starting again.");
  process.exit(1);
}
if (!existsSync(python)) {
  console.error("Neural Python environment is missing. Follow docs/NEURAL.md.");
  process.exit(1);
}
const pythonCheck = spawnSync(path.resolve(python), ["-c", "import sys; print(sys.version_info.major)"], { cwd: root, encoding: "utf8", windowsHide: true });
if (pythonCheck.status !== 0) {
  console.error("Python environment could not start. If this folder was moved, rebuild the Python environments using the installation guide. Run ./scripts/setup.ps1 on Windows or bash scripts/setup.sh on macOS/Linux after repairing the environment.");
  if (pythonCheck.stderr) console.error(pythonCheck.stderr.trim());
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
if (process.argv.includes("--open")) {
  console.log("Keep this window open while using Studio. Press Ctrl+C here to stop it.");
  for (let attempt = 0; attempt < 90; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:3000/api/health", { signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        const opener = process.platform === "win32" ? "explorer.exe" : process.platform === "darwin" ? "open" : "xdg-open";
        const browser = spawn(opener, ["http://127.0.0.1:3000"], { windowsHide: true, stdio: "ignore" });
        browser.on("error", () => console.log("Open http://127.0.0.1:3000 in your browser."));
        browser.unref();
        break;
      }
    } catch { /* Wait for the web server, without opening an error page. */ }
    if (attempt === 89) console.log("Browser not opened yet. Check the server log above, then visit http://127.0.0.1:3000.");
    else await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
