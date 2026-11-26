import { spawn } from "node:child_process";
const python =
  process.platform === "win32"
    ? ".venv/Scripts/python.exe"
    : ".venv/bin/python";
const child = spawn(
  python,
  [
    "-m",
    "uvicorn",
    "neural.server:app",
    "--host",
    "127.0.0.1",
    "--port",
    "8123",
  ],
  { stdio: "inherit", windowsHide: true },
);
child.on("error", () => {
  console.error("Neural environment missing. Follow docs/NEURAL.md.");
  process.exit(1);
});
process.on("SIGINT", () => child.kill());
process.on("SIGTERM", () => child.kill());
