"""Warm isolated inference, with explicit DirectML compatibility boundaries."""
import contextlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import gc
import time
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
from neural.hardware import runtime_profile
from neural.accelerated import execute, report
_cache = {}


def clear_cache():
    _cache.clear()
    gc.collect()
    import torch
    for backend in (torch.cuda, getattr(torch, "xpu", None), getattr(torch, "mps", None)):
        try:
            if backend is not None: backend.empty_cache()
        except Exception:
            pass


def cached_model(key, load):
    if _cache.get("key") == key:
        return _cache["value"], True
    clear_cache()
    value = load()
    _cache.update(key=key, value=value)
    return value, False


def natural(data, profile):
    import numpy as np
    import torch
    from neural.parler_worker import short_parts, apply_controls
    engine, speaker = data["voice"].split(":", 1)
    device = profile["device"]
    # DirectML lacks recurrent kernels used by these frontends. Keep text/prosody
    # on CPU and move the waveform decoder to the GPU with explicit boundaries.
    def accelerate_decoder(decoder):
        from neural.directml_ops import decoder_to_directml
        profile["cpuOperators"] = decoder_to_directml(torch, decoder, device)
        profile["executionMode"] = "hybrid: CPU text/prosody + GPU waveform decoder"
    def load_natural():
        if engine == "kokoro":
            from kokoro import KModel
            model = KModel(config=str(ROOT / ".models/kokoro/config.json"), model=str(ROOT / ".models/kokoro/kokoro-v1_0.pth"), disable_complex=False).to("cpu").eval()
            if device != "cpu": accelerate_decoder(model.decoder)
            return model, dict(profile), {}
        return load_mithi()

    def load_mithi():
        from transformers import AlbertModel
        original = AlbertModel.from_pretrained
        def compatible_albert(*args, **kwargs):
            if "dtype" in kwargs: kwargs["torch_dtype"] = kwargs.pop("dtype")
            kwargs["attn_implementation"] = "eager"
            return original(*args, **kwargs)
        spec = importlib.util.spec_from_file_location("mithi_inference", ROOT / ".models/mithi/run.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        AlbertModel.from_pretrained = staticmethod(compatible_albert)
        try: model = module.Mithi(str(ROOT / ".models/mithi"), device="cpu")
        finally: AlbertModel.from_pretrained = original
        if device != "cpu": accelerate_decoder(model.kokoro.decoder)
        return model, dict(profile), {}

    if engine not in {"mithi", "kokoro"}: raise ValueError("Unknown natural engine")
    (model, metadata, pipelines), warm = cached_model((engine, device), load_natural)
    profile.update({k: metadata[k] for k in ("executionMode", "cpuOperators") if k in metadata})
    profile["modelCacheHit"] = warm
    if engine == "kokoro":
        from kokoro import KPipeline
        if speaker[0] not in pipelines:
            pipelines[speaker[0]] = KPipeline(lang_code=speaker[0], model=model, device="cpu")
        pipeline = pipelines[speaker[0]]
    chunks, length = [], 0
    for part in short_parts(data["text"]):
        if isinstance(part, float): audio = np.zeros(round(part * 24000), dtype=np.float32)
        elif engine == "mithi": audio = model.synthesize(part, lang="bn", voice=speaker)
        else:
            output = list(pipeline(part, voice=str(ROOT / ".models/kokoro/voices" / f"{speaker}.pt"), speed=1))
            audio = np.concatenate([np.asarray(item.audio) for item in output]) if output else np.zeros(0, dtype=np.float32)
        if not isinstance(part, float): audio = apply_controls(np.asarray(audio), data["rate"], data["pitch"])
        audio = np.asarray(audio, dtype=np.float32).reshape(-1)
        if not np.isfinite(audio).all(): raise RuntimeError("Invalid accelerator audio")
        length += len(audio)
        if length > 600 * 24000: raise ValueError("Audio exceeds runtime duration limit")
        chunks.append(audio)
    if not length: raise RuntimeError("Accelerator returned empty speech")
    return (np.clip(np.concatenate(chunks), -1, 1) * 32767).astype("<i2").tobytes()


def generate(data, requested=None, on_progress=None):
    import torch
    started = time.monotonic()
    with contextlib.redirect_stdout(sys.stderr):
        engine = data["voice"].split(":", 1)[0]
        requested = requested or os.environ.get("BYTEMINUS_EXECUTION_BACKEND", "directml")
        previous = _cache.get("hardware", {})
        if _cache.get("key", (None,))[0] == engine and (requested == "auto" or previous.get("backend") == requested):
            # Resident weights already consume accelerator memory. Requiring the
            # initial free-memory minimum again would evict a working warm model.
            profile = dict(previous)
        else:
            clear_cache()
            profile = runtime_profile(torch, engine=engine, requested=requested)
        def operation(selected):
            if on_progress: on_progress(dict(stage="Loading or preparing the speech model…"))
            if engine in {"parler", "indic"}:
                from neural.parler_worker import load_model, synthesize
                def load():
                    model, tokenizer = load_model(engine, profile=selected)
                    return model, tokenizer, dict(selected)
                (model, tokenizer, metadata), warm = cached_model((engine, selected["device"]), load)
                selected.update({k: metadata[k] for k in ("executionMode", "cpuOperators") if k in metadata})
                selected["modelCacheHit"] = warm
                return synthesize(data, model, tokenizer, on_progress=on_progress)
            return natural(data, selected)
        output, actual = execute(torch, profile, operation, engine=engine)
        actual["renderSeconds"] = round(time.monotonic() - started, 3)
        _cache["hardware"] = dict(actual)
        report(actual)
    return output, actual


if __name__ == "__main__":
    if "--serve" in sys.argv:
        # One model stays warm; switching engines releases the previous model.
        # Framed private stdio avoids opening another network service.
        for line in sys.stdin.buffer:
            try:
                if len(line) > 30000: raise ValueError("Request too large")
                request = json.loads(line.decode("utf-8"))
                def progress(value):
                    sys.__stdout__.buffer.write(json.dumps(dict(event="progress", progress=value)).encode() + b"\n")
                    sys.__stdout__.buffer.flush()
                output, actual = generate(request["input"], requested=request.get("backend"), on_progress=progress)
                header = dict(ok=True, size=len(output), runtime=actual)
            except Exception as exc:
                import traceback
                traceback.print_exc(file=sys.stderr)
                output = b""
                header = dict(ok=False, size=0, error=str(exc)[:300])
            sys.stdout.buffer.write(json.dumps(header).encode() + b"\n" + output)
            sys.stdout.buffer.flush()
    else:
        data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
        output, _ = generate(data)
        sys.stdout.buffer.write(output)
