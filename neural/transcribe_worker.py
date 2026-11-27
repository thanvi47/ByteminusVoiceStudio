"""Transcribe a short reference in memory, offline, then release the model."""
import base64
import contextlib
import io
import json
import os
from pathlib import Path
import sys

os.environ["HF_HUB_OFFLINE"] = "1"
ROOT = Path(__file__).resolve().parents[1]


def transcribe(data):
    from faster_whisper import WhisperModel
    language = data["language"]
    if language not in ("bn", "en"):
        raise ValueError("Unsupported reference language")
    audio = base64.b64decode(data["audio"], validate=True)
    model = WhisperModel(
        str(ROOT / ".models/whisper"), device="cpu", compute_type="int8",
        cpu_threads=4, local_files_only=True,
    )
    segments, _ = model.transcribe(
        io.BytesIO(audio), language=language, beam_size=5,
        initial_prompt="বাংলা ভাষায় কথোপকথন। বাংলা অক্ষরে লিখুন।" if language == "bn" else None,
        temperature=0, max_new_tokens=224,
        condition_on_previous_text=False, vad_filter=False,
    )
    text = " ".join(s.text.strip() for s in segments).strip()
    if len(text) < 2 or len(text) > 1000:
        raise ValueError("No clear speech detected. Try another selection or type the exact words.")
    if language == "bn" and not any("\u0980" <= c <= "\u09ff" for c in text):
        raise ValueError("Bengali speech could not be recognized reliably. Try another selection or type the exact Bengali words.")
    return {"text": text}


if __name__ == "__main__":
    data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    with contextlib.redirect_stdout(sys.stderr):
        result = transcribe(data)
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False).encode("utf-8"))
