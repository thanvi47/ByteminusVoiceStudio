"""Probe real accelerator operations; keep CPU as the portable fallback."""
import importlib
import os
import sys
from neural.cpu_runtime import configure_cpu

BACKENDS = {"auto", "cpu", "cuda", "rocm", "xpu", "mps", "directml"}


def _tensor_probe(torch, device):
    probe = torch.ones((8, 8), device=device)
    value = (probe @ probe).sum().cpu().item()
    if not value > 0:
        raise RuntimeError("Accelerator returned an invalid tensor result")


def runtime_profile(torch, *, engine="expressive", requested=None):
    threads = configure_cpu(torch)
    requested = (requested or os.environ.get("BYTEMINUS_DEVICE", "auto")).lower()
    if requested not in BACKENDS:
        raise ValueError("BYTEMINUS_DEVICE must be auto, cpu, cuda, rocm, xpu, mps or directml")
    device, backend, name, vram = "cpu", "cpu", "CPU", 0
    reasons = []
    minimum = 1 if engine in {"natural", "mithi", "kokoro"} else 6
    candidates = ["cuda", "rocm", "xpu", "mps", "directml"] if requested == "auto" else [requested]
    for candidate in candidates:
        if candidate == "cpu": break
        try:
            gpu_device, gpu_name, total, free = "", "", 0, None
            if candidate in {"cuda", "rocm"}:
                hip = getattr(getattr(torch, "version", None), "hip", None)
                if not torch.cuda.is_available() or bool(hip) != (candidate == "rocm"):
                    raise RuntimeError("matching PyTorch build/driver unavailable")
                available, capacity = torch.cuda.mem_get_info(0)
                gpu_device, gpu_name = "cuda", torch.cuda.get_device_name(0)
                total, free = capacity / 1024**3, available / 1024**3
            elif candidate == "xpu":
                xpu = getattr(torch, "xpu", None)
                if xpu is None or not xpu.is_available():
                    raise RuntimeError("Intel XPU build/driver unavailable")
                gpu_device, gpu_name = "xpu", xpu.get_device_name(0)
                total = xpu.get_device_properties(0).total_memory / 1024**3
                if hasattr(xpu, "mem_get_info"): free = xpu.mem_get_info(0)[0] / 1024**3
            elif candidate == "mps":
                mps = getattr(getattr(torch, "backends", None), "mps", None)
                if sys.platform != "darwin" or mps is None or not mps.is_available():
                    raise RuntimeError("Apple Metal/MPS unavailable")
                gpu_device, gpu_name = "mps", "Apple Metal (MPS)"
                if hasattr(torch.mps, "recommended_max_memory"):
                    total = torch.mps.recommended_max_memory() / 1024**3
                    free = max(0, total - torch.mps.driver_allocated_memory() / 1024**3)
            elif candidate == "directml":
                if sys.platform != "win32": raise RuntimeError("this DirectML adapter requires Windows")
                dml = importlib.import_module("torch_directml")
                if dml.device_count() < 1: raise RuntimeError("no compatible DirectX 12 GPU found")
                gpu_device, gpu_name = str(dml.device()), dml.device_name(0)
            if free is not None and free < minimum:
                raise RuntimeError(f"less than {minimum} GB accelerator memory available for {engine}")
            _tensor_probe(torch, gpu_device)
            device, backend, name, vram = gpu_device, candidate, str(gpu_name).replace("\x00", "").strip(), round(total, 1)
            break
        except Exception as exc:
            reasons.append(f"{candidate.upper()}: {str(exc)[:160]}")
    if requested not in {"auto", "cpu"} and backend == "cpu":
        raise RuntimeError("; ".join(reasons) or f"{requested} unavailable")
    accelerated = backend != "cpu"
    large, medium = accelerated and vram >= 16, accelerated and vram >= 6
    return dict(device=device, backend=backend, name=name, platform=sys.platform,
                vramGB=vram, cpuThreads=threads, logicalProcessors=os.cpu_count() or 1,
                reason="; ".join(reasons), validation="tensor probe only; speech not yet verified",
                batchCharacters=1200 if large else 600 if medium else 160 if threads <= 2 else 240 if threads <= 4 else 300,
                requestTimeoutSeconds=1200, maxScriptCharacters=12000 if large else 6000 if medium else 3000,
                maxAudioSeconds=1800 if accelerated else 600)


def cpu_fallback(torch, profile, error, *, engine="expressive"):
    result = runtime_profile(torch, requested="cpu", engine=engine)
    result.update(reason=f"{profile.get('backend', profile['device'])} speech failed; same model retried on CPU: {str(error)[:220]}",
                  attemptedBackend=profile.get("backend", profile["device"]))
    return result
