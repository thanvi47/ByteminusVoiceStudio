"""Select a usable accelerator, not just a GPU name or installed driver."""
import os
import sys
from neural.cpu_runtime import configure_cpu


def runtime_profile(torch):
    threads = configure_cpu(torch)
    requested = os.environ.get("BYTEMINUS_DEVICE", "auto").lower()
    if requested not in {"auto", "cpu", "cuda"}:
        raise ValueError("BYTEMINUS_DEVICE must be auto, cpu or cuda")
    device, name, vram, reason = "cpu", "CPU", 0, ""
    if requested != "cpu" and torch.cuda.is_available():
        try:
            free, total = torch.cuda.mem_get_info(0)
            vram = round(total / 1024**3, 1)
            if free < 6 * 1024**3:
                raise RuntimeError("Less than 6 GB free CUDA memory; using CPU")
            # Tests kernel compatibility too (important for new GPU architectures).
            probe = torch.ones((8, 8), device="cuda")
            (probe @ probe).sum().item()
            del probe
            device, name = "cuda", torch.cuda.get_device_name(0)
        except Exception as exc:
            reason = str(exc)[:240]
    elif requested != "cpu":
        reason = "CUDA is unavailable in this Python environment. NVIDIA GPUs need a compatible CUDA PyTorch build and driver."
    if requested == "cuda" and device != "cuda":
        raise RuntimeError(reason or "CUDA was requested but is unavailable")
    return dict(device=device, name=name, platform=sys.platform, vramGB=vram, cpuThreads=threads,
                logicalProcessors=os.cpu_count() or 1, reason=reason,
                batchCharacters=1200 if device == "cuda" and vram >= 16 else 600 if device == "cuda" else 160 if threads <= 2 else 240 if threads <= 4 else 300,
                requestTimeoutSeconds=1200, maxScriptCharacters=12000 if device == "cuda" and vram >= 16 else 6000 if device == "cuda" else 3000,
                maxAudioSeconds=1800 if device == "cuda" else 600)
