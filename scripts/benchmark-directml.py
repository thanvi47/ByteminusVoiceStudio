"""Reproduce actual CPU versus DirectML speech timings with fixed public scripts."""
import argparse
import json
from pathlib import Path
import sys
import time
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from neural.isolated_runtime import PersistentWorker


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", choices=["kokoro", "mithi"], default="mithi")
    args = parser.parse_args()
    python = ROOT / ".runtime/directml-env/Scripts/python.exe"
    if sys.platform != "win32" or not python.exists():
        parser.error("Windows DirectML environment required. Run ./scripts/setup-directml.ps1 first.")
    voice, text = {
        "kokoro": ("kokoro:af_heart", "Today is a wonderful day. We are testing a natural voice on the graphics processor."),
        "mithi": ("mithi:charvi", "আজ একটি নতুন দিন। আমরা কম্পিউটারের সাহায্যে একটি সুন্দর গল্প শুনব।"),
    }[args.engine]
    output = ROOT / ".cache/benchmarks"
    output.mkdir(parents=True, exist_ok=True)
    worker = PersistentWorker(python, ROOT / "neural/device_worker.py", cwd=ROOT)
    rows = []
    try:
        for backend in ("cpu", "directml"):
            for repeat in range(3):
                started = time.monotonic()
                pcm, actual = worker.request(dict(voice=voice, text=text, emotion="Neutral", intensity=0, rate=1, pitch=1, style=""), backend=backend)
                if actual["backend"] != backend:
                    raise RuntimeError("GPU speech was not verified: " + actual.get("reason", "CPU fallback"))
                row = dict(voice=voice, backend=backend, repeat=repeat, seconds=round(time.monotonic()-started, 3), audioSeconds=round(len(pcm)/48000, 3), runtime=actual)
                rows.append(row)
                print(json.dumps(row), flush=True)
                with wave.open(str(output / f"{args.engine}-{backend}.wav"), "wb") as audio:
                    audio.setnchannels(1); audio.setsampwidth(2); audio.setframerate(24000); audio.writeframes(pcm)
    finally:
        worker.close()
        (output / f"{args.engine}.json").write_text(json.dumps(rows, indent=2), encoding="utf-8")
    cpu = sum(r["seconds"] for r in rows if r["backend"] == "cpu" and r["repeat"] > 0) / 2
    gpu = sum(r["seconds"] for r in rows if r["backend"] == "directml" and r["repeat"] > 0) / 2
    print(f"Warm mean: CPU {cpu:.3f}s; DirectML {gpu:.3f}s; ratio {cpu/gpu:.2f}x. Same isolated Torch version; not a universal speed claim.")
    print(f"Fixed-script WAVs and timings saved locally under {output}")


if __name__ == "__main__": main()
