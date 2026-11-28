"""A bounded private stdio worker that keeps one accelerator model warm."""
import atexit
from collections import deque
import json
import os
from pathlib import Path
from queue import Queue, Empty
import subprocess
import threading
import time


class PersistentWorker:
    def __init__(self, python, script, *, cwd):
        self.command = [str(Path(python).resolve()), str(Path(script).resolve()), "--serve"]
        self.cwd = cwd
        self.process = None
        self.lock = threading.Lock()
        self.errors = deque(maxlen=8)
        atexit.register(self.close)

    def close(self):
        process, self.process = self.process, None
        if process is None: return
        try:
            if process.poll() is None:
                if os.name == "nt":
                    # Python venv launchers create a child on Windows.
                    subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], capture_output=True, timeout=10)
                else:
                    process.kill()
            process.wait(timeout=10)
        except (OSError, subprocess.TimeoutExpired):
            pass
        finally:
            for pipe in (process.stdin, process.stdout, process.stderr):
                try: pipe.close()
                except OSError: pass

    def _start(self):
        if self.process is not None and self.process.poll() is None: return
        self.close()
        self.errors.clear()
        process = subprocess.Popen(self.command, cwd=self.cwd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                   stderr=subprocess.PIPE, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
        self.process = process
        def drain():
            try:
                while line := process.stderr.readline(2000):
                    self.errors.append(line.decode(errors="replace"))
            except (OSError, ValueError):
                pass
        threading.Thread(target=drain, daemon=True).start()

    def request(self, data, *, backend="directml", timeout=1200, cancel_event=None):
        with self.lock:
            self._start()
            process = self.process
            result = Queue(maxsize=1)
            def exchange():
                try:
                    process.stdin.write(json.dumps(dict(input=data, backend=backend), ensure_ascii=False).encode("utf-8") + b"\n")
                    process.stdin.flush()
                    line = process.stdout.readline(10000)
                    if not line or not line.endswith(b"\n"): raise RuntimeError("Accelerator worker exited before its response")
                    header = json.loads(line)
                    size = header.get("size", -1)
                    if not isinstance(size, int) or not 0 <= size <= 1800 * 24000 * 2 or size % 2:
                        raise RuntimeError("Invalid accelerator response size")
                    if not header.get("ok"): raise RuntimeError(header.get("error", "Accelerator worker failed"))
                    audio = process.stdout.read(size)
                    if len(audio) != size or not size: raise RuntimeError("Incomplete accelerator audio")
                    result.put((audio, header["runtime"]))
                except Exception as exc:
                    result.put(exc)
            threading.Thread(target=exchange, daemon=True).start()
            try:
                deadline = time.monotonic() + timeout
                while True:
                    if cancel_event is not None and cancel_event.is_set():
                        raise RuntimeError("GENERATION_CANCELLED")
                    remaining = deadline - time.monotonic()
                    if remaining <= 0: raise Empty()
                    try:
                        response = result.get(timeout=min(0.2, remaining))
                        break
                    except Empty:
                        if time.monotonic() >= deadline: raise
                if isinstance(response, Exception): raise response
                return response
            except Empty:
                self.close()
                raise subprocess.TimeoutExpired(self.command, timeout) from None
            except Exception as exc:
                self.close()
                if isinstance(exc, RuntimeError): raise
                raise RuntimeError(f"Accelerator worker protocol failed: {type(exc).__name__}") from exc
