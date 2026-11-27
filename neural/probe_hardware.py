"""Probe a separate Python environment without loading speech weights."""
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import torch
from neural.hardware import runtime_profile
print(json.dumps(runtime_profile(torch)))
