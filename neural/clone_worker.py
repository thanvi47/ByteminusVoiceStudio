"""Offline, one-shot voice cloning; profiles stay in ignored local storage."""

import contextlib
import json
import os
from pathlib import Path
import sys
import uuid

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
from neural.hardware import runtime_profile
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"


def decode_request(payload):
    # Windows redirected stdin may default to a legacy code page. Node sends UTF-8.
    return json.loads(payload.decode("utf-8"))


def render(data):
    import numpy as np
    import soundfile as sf
    import torch
    from omnivoice import OmniVoice

    hardware = runtime_profile(torch)
    folder = ROOT / ".data/voices" / str(uuid.UUID(data["id"]))
    profile = json.loads((folder / "profile.json").read_text(encoding="utf-8"))
    reference, sr = sf.read(folder / "reference.wav", dtype="float32")
    if sr != 24000 or reference.ndim != 1 or not 3 <= len(reference) / sr <= 10:
        raise ValueError("Invalid saved reference")
    if data["language"] not in ("bn", "en") or not 2 <= len(data["text"]) <= 600:
        raise ValueError("Invalid script")
    # No ASR download: the user supplies the exact selected reference transcript.
    model = OmniVoice.from_pretrained(
        str(ROOT / ".models/omnivoice"),
        device_map=hardware["device"],
        dtype=torch.float32,
        local_files_only=True,
        load_asr=False,
    ).eval()
    result = model.generate(
        text=data["text"],
        language=data["language"],
        ref_audio=(torch.from_numpy(reference).unsqueeze(0), sr),
        ref_text=profile["transcript"],
        num_step=16,
        speed=data.get("rate", 1),
    )[0]
    audio = np.asarray(result, dtype=np.float32).reshape(-1)
    if not len(audio) or len(audio) > 90 * 24000 or not np.isfinite(audio).all():
        raise ValueError("Invalid output or output exceeds 90 seconds")
    return (np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes()


if __name__ == "__main__":
    data = decode_request(sys.stdin.buffer.read())
    with contextlib.redirect_stdout(sys.stderr):
        output = render(data)
    sys.stdout.buffer.write(output)
