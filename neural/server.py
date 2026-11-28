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
RUNTIME_VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
import numpy as np
import torch
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel, Field, ConfigDict
from neural.hardware import runtime_profile, cpu_fallback
from neural.isolated_runtime import PersistentWorker

HARDWARE = runtime_profile(torch, engine="natural", requested="cpu" if os.environ.get("BYTEMINUS_DEVICE") == "directml" else None)
CPU_THREADS = HARDWARE["cpuThreads"]
app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
CATALOG = {
    v["id"]: v
    for v in json.loads(
        (ROOT / "lib" / "voice-catalog.json").read_text(encoding="utf-8")
    )
}
lock = threading.Lock()
cancel_event = threading.Event()
generation_state_lock = threading.Lock()
active_generation = None
active_progress = {}
pending_cancellations = {}
loaded = {}
def report_progress(value):
    with generation_state_lock:
        active_progress.clear()
        active_progress.update(value)

@app.get("/progress")
def generation_progress(id: str):
    with generation_state_lock:
        if not active_generation or id != active_generation: raise HTTPException(404, "Generation not active.")
        return dict(active_progress)
PARLER_PYTHON = (
    ROOT
    / ".runtime/parler-env"
    / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
)
EXPRESSIVE_HARDWARE = HARDWARE
if PARLER_PYTHON.exists():
    try:
        probe = subprocess.run([str(PARLER_PYTHON), str(ROOT / "neural/probe_hardware.py")],
                               capture_output=True, timeout=30, cwd=ROOT)
        if probe.returncode == 0:
            EXPRESSIVE_HARDWARE = json.loads(probe.stdout)
        else:
            EXPRESSIVE_HARDWARE = {**HARDWARE, "device": "unavailable", "name": "Expressive runtime unavailable",
                                   "reason": "The expressive Python environment could not initialize. Check the neural server log."}
    except (OSError, subprocess.TimeoutExpired, ValueError):
        EXPRESSIVE_HARDWARE = {**HARDWARE, "device": "unavailable", "name": "Expressive runtime unavailable"}


ENGINE_HARDWARE = {"mithi": dict(HARDWARE), "kokoro": dict(HARDWARE),
                   "parler": dict(EXPRESSIVE_HARDWARE), "indic": dict(EXPRESSIVE_HARDWARE)}
DIRECTML_PYTHON = ROOT / ".runtime/directml-env/Scripts/python.exe"
DIRECTML_WORKER = PersistentWorker(DIRECTML_PYTHON, ROOT / "neural/device_worker.py", cwd=ROOT)
EXPRESSIVE_WORKER = PersistentWorker(PARLER_PYTHON, ROOT / "neural/device_worker.py", cwd=ROOT)
if os.name == "nt" and DIRECTML_PYTHON.exists() and os.environ.get("BYTEMINUS_DEVICE", "auto") in {"auto", "directml"}:
    try:
        probe = subprocess.run([str(DIRECTML_PYTHON), str(ROOT / "neural/probe_hardware.py"), "--backend", "directml"],
                               capture_output=True, timeout=45, cwd=ROOT)
        if probe.returncode == 0:
            directml_profile = json.loads(probe.stdout)
            for engine, profile in ENGINE_HARDWARE.items():
                if profile["device"] in {"cpu", "unavailable"}: ENGINE_HARDWARE[engine] = dict(directml_profile)
        elif os.environ.get("BYTEMINUS_DEVICE") == "directml":
            raise RuntimeError("DirectML runtime could not initialize. Run scripts/setup-directml.ps1 and check the GPU driver.")
    except (OSError, subprocess.TimeoutExpired, ValueError):
        if os.environ.get("BYTEMINUS_DEVICE") == "directml": raise
if os.environ.get("BYTEMINUS_DEVICE") == "directml" and not DIRECTML_PYTHON.exists():
    raise RuntimeError("DirectML environment missing. Run ./scripts/setup-directml.ps1 first.")


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
    generationId: str | None = Field(default=None, pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


class CancelInput(BaseModel):
    generationId: str = Field(pattern=r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")


def check_cancelled():
    if cancel_event.is_set(): raise HTTPException(499, "Generation cancelled.")


@app.post("/cancel")
def cancel_generation(data: CancelInput):
    with generation_state_lock:
        if active_generation == data.generationId:
            cancel_event.set()
            return {"cancelling": True}
        now = time.monotonic()
        for key, created in list(pending_cancellations.items()):
            if now-created > 120: pending_cancellations.pop(key, None)
        if len(pending_cancellations) >= 256: raise HTTPException(429, "Too many pending cancellations")
        pending_cancellations[data.generationId] = now
        return {"cancelling": False}


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
        and (PARLER_PYTHON.exists() or DIRECTML_PYTHON.exists()) and ENGINE_HARDWARE["parler"]["device"] != "unavailable",
        "indic": all((ROOT / file).is_file() for file in [
            ".models/indic/model.safetensors", ".models/indic/config.json",
            ".models/indic/tokenizer.json", ".models/indic/tokenizer_config.json",
            ".models/indic-description/spiece.model", ".models/indic-description/config.json",
        ])
        and (PARLER_PYTHON.exists() or DIRECTML_PYTHON.exists()) and ENGINE_HARDWARE["indic"]["device"] != "unavailable",
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "runtimeVersion": RUNTIME_VERSION,
        "engines": installed(),
        "device": HARDWARE["device"],
        "hardware": HARDWARE,
        "engineHardware": ENGINE_HARDWARE,
        "cpuThreads": CPU_THREADS,
        "busy": lock.locked(),
        "logicalProcessors": os.cpu_count() or 1,
        "loaded": list(loaded),
    }


def release_main_models():
    loaded.clear()
    gc.collect()
    for backend in (torch.cuda, getattr(torch, "xpu", None), getattr(torch, "mps", None)):
        try:
            if backend is not None: backend.empty_cache()
        except Exception:
            pass


@app.post("/release")
def release_models():
    if not lock.acquire(blocking=False):
        raise HTTPException(409, "Wait for the current speech generation to finish.")
    try:
        DIRECTML_WORKER.close()
        EXPRESSIVE_WORKER.close()
        release_main_models()
        return {"released": True}
    finally:
        lock.release()


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
        loaded[engine] = module.Mithi(str(ROOT / ".models/mithi"), device=ENGINE_HARDWARE[engine]["device"])
    elif engine == "kokoro":
        from kokoro import KModel, KPipeline

        model = (
            KModel(
                config=str(ROOT / ".models/kokoro/config.json"),
                model=str(ROOT / ".models/kokoro/kokoro-v1_0.pth"), disable_complex=True,
            )
            .to(ENGINE_HARDWARE[engine]["device"])
            .eval()
        )
        loaded[engine] = {
            lang: KPipeline(lang_code=lang, model=model, device=ENGINE_HARDWARE[engine]["device"])
            for lang in ["a", "b"]
        }
    return loaded[engine]


def render(data):
    profile = CATALOG[data.voice]
    engine = profile["engine"]
    speaker = data.voice.split(":", 1)[1]
    if not installed().get(engine):
        if engine == "indic":
            setup = ".venv/Scripts/hf.exe auth login, then ./scripts/setup-bengali-expressive.ps1" if os.name == "nt" else ".venv/bin/hf auth login, then bash scripts/setup.sh --bengali-expressive"
            raise HTTPException(503, f"Bengali expressive (Indic) model/runtime is missing or unavailable. Base setup does not install Indic. Accept model access at huggingface.co/ai4bharat/indic-parler-tts, run {setup}, then restart the studio.")
        raise HTTPException(
            503, f"{engine} is not installed. Run the neural setup script."
        )
    directml = ENGINE_HARDWARE[engine].get("backend") == "directml"
    isolated_directml = directml or (engine in {"parler", "indic"} and not PARLER_PYTHON.exists() and DIRECTML_PYTHON.exists())
    if isolated_directml:
        EXPRESSIVE_WORKER.close()
        release_main_models()
        script_parts(data.text)
        output, actual = DIRECTML_WORKER.request(data.model_dump(), backend=ENGINE_HARDWARE[engine].get("backend", "cpu"), cancel_event=cancel_event, on_progress=report_progress)
        ENGINE_HARDWARE[engine] = actual
        if actual["device"] == "cpu": DIRECTML_WORKER.close()
        return output, 24000
    if engine in {"parler", "indic"}:
        DIRECTML_WORKER.close()
        release_main_models()
        script_parts(data.text)
        output, actual = EXPRESSIVE_WORKER.request(data.model_dump(), backend=ENGINE_HARDWARE[engine].get("backend", "cpu"), cancel_event=cancel_event, on_progress=report_progress)
        ENGINE_HARDWARE[engine] = actual
        return output, 24000
    DIRECTML_WORKER.close()
    EXPRESSIVE_WORKER.close()
    model = model_for(engine)
    chunks = []
    length = 0
    for part in script_parts(data.text):
        check_cancelled()
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
        if length > HARDWARE["maxAudioSeconds"] * 24000:
            raise HTTPException(
                413, "Audio exceeds the runtime duration limit. Generate shorter sections."
            )
        chunks.append(audio)
    if not length:
        raise ValueError("Empty audio")
    return (np.clip(np.concatenate(chunks), -1, 1) * 32767).astype(
        "<i2"
    ).tobytes(), 24000


@app.post("/synthesize")
def synthesize(data: Input):
    global active_generation
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
        with generation_state_lock:
            active_generation = data.generationId
            active_progress.clear()
            active_progress.update(stage="Preparing the speech engine…")
            cancel_event.clear()
            if data.generationId in pending_cancellations:
                pending_cancellations.pop(data.generationId)
                cancel_event.set()
        check_cancelled()
        engine = CATALOG[data.voice]["engine"]
        try:
            pcm, sr = render(data)
        except (RuntimeError, NotImplementedError) as exc:
            check_cancelled()
            if ENGINE_HARDWARE[engine]["device"] == "cpu" or os.environ.get("BYTEMINUS_DEVICE", "auto") != "auto": raise
            profile = ENGINE_HARDWARE[engine]
            loaded.pop(engine, None)
            gc.collect()
            ENGINE_HARDWARE[engine] = cpu_fallback(torch, profile, exc, engine=engine)
            pcm, sr = render(data)
        check_cancelled()
        ENGINE_HARDWARE[engine]["validation"] = "speech generated"
        print(
            f"{data.voice}: {len(pcm) / (2 * sr):.2f}s audio in {time.monotonic() - started:.2f}s",
            flush=True,
        )
        return Response(
            pcm,
            media_type="application/octet-stream",
            headers={"X-Sample-Rate": str(sr), "X-Speech-Backend": ENGINE_HARDWARE[engine].get("backend", "cpu")},
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
        with generation_state_lock:
            active_generation = None
            cancel_event.clear()
        lock.release()
