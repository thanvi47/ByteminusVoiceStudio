"""Isolated natural/expressive inference for Windows DirectML."""
import contextlib
import importlib.util
import json
import os
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["HF_HUB_OFFLINE"] = "1"
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
from neural.hardware import runtime_profile
from neural.accelerated import execute, report


def natural(data, profile):
    import numpy as np
    import torch
    from neural.parler_worker import short_parts, apply_controls
    engine, speaker = data["voice"].split(":", 1)
    device = profile["device"]
    # DirectML lacks recurrent kernels used by these frontends. Keep text/prosody
    # on CPU and move the waveform decoder to the GPU with explicit boundaries.
    def accelerate_decoder(decoder):
        decoder.to(device)
        def move(value, target):
            if isinstance(value, torch.Tensor): return value.to(target)
            if isinstance(value, tuple): return tuple(move(v, target) for v in value)
            if isinstance(value, list): return [move(v, target) for v in value]
            return value
        decoder.register_forward_pre_hook(lambda module, args: move(args, device))
        decoder.register_forward_hook(lambda module, args, output: move(output, "cpu"))
        profile["executionMode"] = "hybrid: CPU text/prosody + GPU waveform decoder"
    if engine == "mithi":
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
    elif engine == "kokoro":
        from kokoro import KModel, KPipeline
        model = KModel(config=str(ROOT / ".models/kokoro/config.json"), model=str(ROOT / ".models/kokoro/kokoro-v1_0.pth"),
                       disable_complex=True).to("cpu").eval()
        if device != "cpu": accelerate_decoder(model.decoder)
        pipeline = KPipeline(lang_code=speaker[0], model=model, device="cpu")
    else:
        raise ValueError("Unknown natural engine")
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


if __name__ == "__main__":
    import torch
    data = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    with contextlib.redirect_stdout(sys.stderr):
        engine = data["voice"].split(":", 1)[0]
        profile = runtime_profile(torch, engine=engine, requested=os.environ.get("BYTEMINUS_EXECUTION_BACKEND", "directml"))
        def operation(selected):
            if engine in {"parler", "indic"}:
                from neural.parler_worker import load_model, synthesize
                model, tokenizer = load_model(engine, profile=selected)
                return synthesize(data, model, tokenizer)
            return natural(data, selected)
        output, actual = execute(torch, profile, operation, engine=engine)
        report(actual)
    sys.stdout.buffer.write(output)
