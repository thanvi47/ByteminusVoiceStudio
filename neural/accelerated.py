"""Retry the same model on CPU when automatic GPU execution is unsupported."""
import gc
import json
import os
import sys
import warnings
from neural.hardware import cpu_fallback


def execute(torch, profile, operation, *, engine):
    failure = None
    try:
        with warnings.catch_warnings(record=True) as messages:
            warnings.simplefilter("always")
            result = operation(profile)
        profile = {**profile, "validation": "speech generated", "mixedOperations": bool(profile.get("executionMode")) or any(
            "fallback" in str(w.message).lower() or "fall back" in str(w.message).lower() for w in messages)}
        return result, profile
    except (RuntimeError, NotImplementedError) as error:
        if profile.get("backend", "cpu") == "cpu" or os.environ.get("BYTEMINUS_DEVICE", "auto") != "auto":
            raise
        failure = str(error)
    # Leave the exception block before releasing failed model allocations.
    gc.collect()
    for module in [getattr(torch, "cuda", None), getattr(torch, "xpu", None), getattr(torch, "mps", None)]:
        try:
            if module is not None and hasattr(module, "empty_cache"): module.empty_cache()
        except Exception:
            pass
    fallback = cpu_fallback(torch, profile, failure, engine=engine)
    result = operation(fallback)
    return result, {**fallback, "validation": "speech generated", "mixedOperations": False}


def report(profile):
    print("BYTEMINUS_RUNTIME:" + json.dumps(profile), file=sys.stderr, flush=True)
