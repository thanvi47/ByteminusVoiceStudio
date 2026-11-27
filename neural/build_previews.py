"""Precompute generic, neutral samples; never record private user scripts."""

import argparse
import json
from pathlib import Path
import re
import time
import wave

ROOT = Path(__file__).resolve().parents[1]
TEXT_BN = "হ্যালো! চলুন, আপনার গল্পকে কণ্ঠ দিই।"
TEXT_EN = "Hello! Let's bring your story to life."


def main(engine):
    voices = json.loads((ROOT / "lib/voice-catalog.json").read_text(encoding="utf-8"))
    voices = [v for v in voices if v["engine"] == engine]
    output = ROOT / ".cache/preview-pcm/v1"
    output.mkdir(parents=True, exist_ok=True)
    pending = []
    for voice in voices:
        path = output / (re.sub(r"[^A-Za-z0-9_-]", "-", voice["id"]) + ".wav")
        if path.exists():
            with wave.open(str(path)) as audio:
                if audio.getnframes() > 0:
                    continue
        pending.append((voice, path))
    if not pending:
        print(f"{engine}: all saved samples already exist", flush=True)
        return
    if engine == "parler":
        from neural.parler_worker import load_model, synthesize

        model, tokenizer = load_model()
    else:
        from neural.server import Input, render
    failures = []
    for index, (voice, path) in enumerate(pending):
        started = time.monotonic()
        data = {
            "voice": voice["id"],
            "text": TEXT_BN if voice["language"] == "bn" else TEXT_EN,
            "emotion": "Neutral",
            "intensity": 50,
            "rate": 1,
            "pitch": 1,
            "style": "",
        }
        try:
            if engine == "parler":
                pcm, sr = synthesize(data, model, tokenizer), 24000
            else:
                pcm, sr = render(Input(**data))
            temporary = path.with_suffix(".partial")
            with wave.open(str(temporary), "wb") as audio:
                audio.setparams((1, 2, sr, 0, "NONE", "not compressed"))
                audio.writeframes(pcm)
            temporary.replace(path)
            print(
                f"[{index + 1}/{len(pending)}] Saved {voice['id']}: {len(pcm) / 2 / sr:.2f}s ({time.monotonic() - started:.1f}s)",
                flush=True,
            )
        except Exception as exc:
            failures.append(voice["id"])
            print(f"Failed {voice['id']}: {exc}", flush=True)
    if failures:
        raise RuntimeError("Failed previews: " + ", ".join(failures))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("engine", choices=["mithi", "kokoro", "parler"])
    main(parser.parse_args().engine)
