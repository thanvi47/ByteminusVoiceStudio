"""Bound CPU parallelism without spawning multiple copies of large models."""
import os


def cpu_threads():
    available = os.cpu_count() or 1
    raw = os.environ.get("BYTEMINUS_CPU_THREADS", "")
    try:
        requested = int(raw) if raw else min(8, max(1, available // 2))
    except ValueError:
        raise ValueError("BYTEMINUS_CPU_THREADS must be an integer") from None
    if requested < 1:
        raise ValueError("BYTEMINUS_CPU_THREADS must be positive")
    return min(requested, available)


def configure_cpu(torch):
    threads = cpu_threads()
    torch.set_num_threads(threads)
    return threads
