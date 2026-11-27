"""Probe a separate Python environment without loading speech weights."""
import json
import argparse
import os
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.setdefault("PYTORCH_ENABLE_MPS_FALLBACK", "1")
import torch
from neural.hardware import runtime_profile
parser = argparse.ArgumentParser()
parser.add_argument("--backend", default=None)
parser.add_argument("--engine", default="expressive")
args = parser.parse_args()
print(json.dumps(runtime_profile(torch, requested=args.backend, engine=args.engine)))
