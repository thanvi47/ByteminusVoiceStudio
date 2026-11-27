"""Loopback-only local neural TTS service. No hosted inference providers."""

import gc
import importlib.util
import json
import math
import os
from pathlib import Path
import re
import subprocess
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
import numpy as np
import torch
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field, ConfigDict
from neural.cpu_runtime import configure_cpu

CPU_THREADS = configure_cpu(torch)
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
CATALOG = {
    v["id"]: v
    for v in json.loads(
        (ROOT / "lib" / "voice-catalog.json").read_text(encoding="utf-8")
    )
}
lock = threading.Lock()
loaded = {}
PARLER_PYTHON = (
    ROOT
    / ".runtime/parler-env"
    / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
)


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    voice: str
    text: str = Field(min_length=1, max_length=3000)
    emotion: str = Field(default="Neutral", max_length=40)
    intensity: float = Field(default=50, ge=0, le=100)
    rate: float = Field(default=1, ge=0.5, le=2)
    pitch: float = Field(default=1, ge=0.5, le=1.5)
    style: str = Field(default="", max_length=1200)
    deliveryRate: float = Field(default=1, ge=0.7, le=1.3)
    deliveryPitch: float = Field(default=1, ge=0.7, le=1.3)


@app.middleware("http")
async def secure_loopback(request: Request, call_next):
    # Browsers may not call this API directly; Next.js is the only intended client.
    if request.headers.get("origin") or request.headers.get("sec-fetch-site"):
        return Response(status_code=403)
    if request.headers.get("host") not in {
        "127.0.0.1:8123",
        "localhost:8123",
        "testserver",
    }:
        return Response(status_code=403)
    if int(request.headers.get("content-length", "0")) > 20000:
        return Response(status_code=413)
    return await call_next(request)


def installed():
    return {
        "mithi": all(
            (ROOT / ".models/mithi" / p).exists()
            for p in [
                "run.py",
                "decoder.safetensors",
                "writer.safetensors",
                "voices.safetensors",
                "indic_encoder/model.safetensors",
            ]
        ),
        "kokoro": (ROOT / ".models/kokoro/kokoro-v1_0.pth").exists(),
        "parler": (ROOT / ".models/parler/model.safetensors").exists()
        and PARLER_PYTHON.exists(),
        "indic": all((ROOT / file).is_file() for file in [
            ".models/indic/model.safetensors", ".models/indic/config.json",
            ".models/indic/tokenizer.json", ".models/indic/tokenizer_config.json",
            ".models/indic-description/spiece.model", ".models/indic-description/config.json",
        ])
        and PARLER_PYTHON.exists(),
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "engines": installed(),
        "device": "cpu",
        "cpuThreads": CPU_THREADS,
        "logicalProcessors": os.cpu_count() or 1,
        "loaded": list(loaded),
    }


def script_parts(text):
    result = []
    last = 0
    for match in re.finditer(r"\[(pause|break)\s+([^\]]+)\]", text, re.I):
        if match.start() > last:
            result.append(text[last : match.start()])
        duration = re.fullmatch(r"(\d+(?:\.\d+)?)(ms|s)", match[2])
        if not duration:
            raise ValueError("Invalid break")
        seconds = float(duration[1]) / (1000 if duration[2] == "ms" else 1)
        if seconds > 10:
            raise ValueError("Break exceeds 10 seconds")
        result.append(seconds)
        last = match.end()
    result.append(text[last:])
    if sum(isinstance(x, float) for x in result) > 30:
        raise ValueError("Too many breaks")
    if any(
        isinstance(x, str) and re.search(r"\[\s*(pause|break)\b", x, re.I)
        for x in result
    ):
        raise ValueError("Invalid break")
    if not any(isinstance(x, str) and x.strip() for x in result):
        raise ValueError("No speech text")
    return result


def model_for(engine):
    if engine in loaded:
        return loaded[engine]
    if engine == "mithi":
        spec = importlib.util.spec_from_file_location(
            "mithi_inference", ROOT / ".models/mithi/run.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        loaded[engine] = module.Mithi(str(ROOT / ".models/mithi"), device="cpu")
    elif engine == "kokoro":
        from kokoro import KModel, KPipeline

        model = (
            KModel(
                config=str(ROOT / ".models/kokoro/config.json"),
                model=str(ROOT / ".models/kokoro/kokoro-v1_0.pth"),
            )
            .to("cpu")
            .eval()
        )
        loaded[engine] = {
            lang: KPipeline(lang_code=lang, model=model, device="cpu")
            for lang in ["a", "b"]
        }
    return loaded[engine]


def render(data):
    profile = CATALOG[data.voice]
    engine = profile["engine"]
    speaker = data.voice.split(":", 1)[1]
    if not installed().get(engine):
        raise HTTPException(
            503, f"{engine} is not installed. Run the neural setup script."
        )
    if engine in {"parler", "indic"}:
        if len(data.text) > 600:
            raise HTTPException(
                400, "Use at most 600 characters with expressive voices on CPU."
            )
        # Separate environment avoids incompatible Transformers requirements and releases RAM after each request.
        loaded.clear()
        gc.collect()
        script_parts(
            data.text
        )  # Validate tags before handing text to the isolated worker.
        result = subprocess.run(
            [str(PARLER_PYTHON), str(ROOT / "neural/parler_worker.py")],
            input=json.dumps(
                {**data.model_dump(), "engine": engine}, ensure_ascii=False
            ).encode("utf-8"),
            capture_output=True,
            timeout=1200,
            cwd=ROOT,
        )
        if result.returncode:
            print(result.stderr.decode(errors="replace")[-3000:], flush=True)
            raise HTTPException(
                503, "Expressive engine failed. Check the local neural server log."
            )
        return result.stdout, 24000
    model = model_for(engine)
    chunks = []
    length = 0
    for part in script_parts(data.text):
        if isinstance(part, float):
            audio = np.zeros(round(part * 24000), dtype=np.float32)
        elif not part.strip():
            continue
        elif engine == "mithi":
            # Apply only explicit manual pitch. Emotion presets must not add DSP artifacts.
            original = model.settings["pitch_shift"]
            model.settings["pitch_shift"] = original + 12 * math.log2(
                data.pitch
            )
            try:
                audio = model.synthesize(part, lang="bn", voice=speaker)
            finally:
                model.settings["pitch_shift"] = original
            speed = data.rate
            if abs(speed - 1) > 0.01:
                import librosa

                audio = librosa.effects.time_stretch(
                    np.asarray(audio, dtype=np.float32), rate=speed
                )
        else:
            chunks_out = list(
                model[speaker[0]](
                    part,
                    voice=str(ROOT / ".models/kokoro/voices" / f"{speaker}.pt"),
                    speed=data.rate,
                )
            )
            audio = (
                np.concatenate([np.asarray(item.audio) for item in chunks_out])
                if chunks_out
                else np.array([], dtype=np.float32)
            )
            shift = 12 * math.log2(data.pitch)
            if abs(shift) > 0.05:
                import librosa

                audio = librosa.effects.pitch_shift(
                    np.asarray(audio, dtype=np.float32), sr=24000, n_steps=shift
                )
        audio = np.asarray(audio, dtype=np.float32).reshape(-1)
        if not np.isfinite(audio).all():
            raise ValueError("Invalid audio")
        length += len(audio)
        if length > 90 * 24000:
            raise HTTPException(
                413, "Audio exceeds 90 seconds. Generate shorter sections."
            )
        chunks.append(audio)
    if not length:
        raise ValueError("Empty audio")
    return (np.clip(np.concatenate(chunks), -1, 1) * 32767).astype(
        "<i2"
    ).tobytes(), 24000


@app.post("/synthesize")
def synthesize(data: Input):
    if data.voice not in CATALOG:
        raise HTTPException(400, "Unknown voice")
    if CATALOG[data.voice]["language"].startswith("en") and re.search(
        r"[\u0980-\u09ff]", data.text
    ):
        raise HTTPException(400, "Use a Bengali voice for Bengali text.")
    try:
        script_parts(data.text)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    if not lock.acquire(blocking=False):
        raise HTTPException(429, "Local neural engine is busy.")
    started = time.monotonic()
    try:
        pcm, sr = render(data)
        print(
            f"{data.voice}: {len(pcm) / (2 * sr):.2f}s audio in {time.monotonic() - started:.2f}s",
            flush=True,
        )
        return Response(
            pcm,
            media_type="application/octet-stream",
            headers={"X-Sample-Rate": str(sr)},
        )
    except HTTPException:
        raise
    except subprocess.TimeoutExpired:
        raise HTTPException(
            504, "Expressive generation timed out. Try a shorter sentence."
        )
    except Exception as exc:
        import traceback

        traceback.print_exc()
        raise HTTPException(
            503, "Neural generation failed. Check the local server log."
        ) from exc
    finally:
        lock.release()
