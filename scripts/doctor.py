"""Offline install checks. Does not download models, read tokens or load speech weights."""
import argparse
import importlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
FILES = {
    'base': ['.models/mithi/run.py', '.models/mithi/decoder.safetensors', '.models/mithi/writer.safetensors',
             '.models/mithi/voices.safetensors', '.models/mithi/indic_encoder/model.safetensors',
             '.models/kokoro/config.json', '.models/kokoro/kokoro-v1_0.pth', '.models/kokoro/voices/af_heart.pt'],
    'expressive': ['.models/parler/model.safetensors', '.models/parler/config.json', '.models/parler/tokenizer_config.json'],
    'indic': ['.models/indic/model.safetensors', '.models/indic/config.json', '.models/indic/tokenizer.json',
              '.models/indic/tokenizer_config.json', '.models/indic-description/config.json', '.models/indic-description/spiece.model'],
    'cloning': ['.models/omnivoice/config.json', '.models/omnivoice/model.safetensors', '.models/omnivoice/tokenizer.json',
                '.models/omnivoice/audio_tokenizer/config.json', '.models/omnivoice/audio_tokenizer/model.safetensors'],
    'transcription': ['.models/whisper/model.bin', '.models/whisper/tokenizer.json'],
}
MODULES = {
    'base': ['torch', 'numpy', 'transformers', 'fastapi', 'uvicorn', 'kokoro', 'librosa', 'soundfile', 'huggingface_hub'],
    'expressive': ['torch', 'torchaudio', 'transformers', 'parler_tts', 'sentencepiece', 'soundfile', 'scipy'],
    'indic': ['torch', 'transformers', 'parler_tts', 'sentencepiece', 'scipy'],
    'cloning': ['torch', 'torchaudio', 'omnivoice'],
    'transcription': ['faster_whisper', 'ctranslate2'],
}
FIXES = {'base': './scripts/setup-neural.ps1', 'expressive': './scripts/setup-neural.ps1 -Expressive',
         'indic': './scripts/setup-bengali-expressive.ps1 (approve HF access and log in first)',
         'cloning': './scripts/setup-cloning.ps1', 'transcription': './scripts/setup-transcription.ps1'}
if sys.platform != 'win32':
    FIXES = {'base': 'bash scripts/setup.sh', 'expressive': 'bash scripts/setup.sh',
             'indic': 'bash scripts/setup.sh --bengali-expressive (approve HF access first)',
             'cloning': 'bash scripts/setup.sh --cloning', 'transcription': 'bash scripts/setup.sh --transcription'}


def probe(profile, packages_only=False):
    errors = []
    for module in MODULES[profile]:
        try:
            importlib.import_module(module)
        except Exception as exc:
            errors.append(f'{module}: {type(exc).__name__}: {str(exc)[:180]}')
    for relative in ([] if packages_only else FILES[profile]):
        target = ROOT / relative
        if not target.is_file() or not target.stat().st_size:
            errors.append(f'Missing or empty file: {relative}')
    if profile == 'base' and not packages_only:
        catalog = json.loads((ROOT / 'lib/voice-catalog.json').read_text(encoding='utf-8'))
        for voice in catalog:
            if voice['engine'] == 'kokoro':
                target = ROOT / '.models/kokoro/voices' / (voice['id'].split(':', 1)[1] + '.pt')
                if not target.is_file() or not target.stat().st_size:
                    errors.append(f'Missing voice data: {voice["id"]}')
    hardware = None
    if profile in {'base', 'expressive', 'indic', 'cloning'} and not errors:
        try:
            import torch
            from neural.hardware import runtime_profile
            hardware = runtime_profile(torch)
        except Exception as exc:
            errors.append(f'Hardware: {str(exc)[:200]}')
    return dict(profile=profile, errors=errors, hardware=hardware)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--all', action='store_true')
    parser.add_argument('--packages-only', action='store_true', help='Check imports/hardware only, without model files')
    parser.add_argument('--probe', choices=FILES)
    args = parser.parse_args()
    if args.probe:
        # Keep library diagnostics separate from machine-readable output.
        import contextlib
        with contextlib.redirect_stdout(sys.stderr):
            result = probe(args.probe, args.packages_only)
        print(json.dumps(result))
        sys.exit(0 if not result['errors'] else 1)
    failures = 0
    for profile in FILES:
        required = profile == 'base' or args.all
        if not required and not (args.packages_only and profile == 'expressive') and not (ROOT / FILES[profile][0]).exists():
            print(f'OPTIONAL {profile}: not installed. Install: {FIXES[profile]}', flush=True)
            continue
        python = ROOT / ('.runtime/parler-env' if profile in {'expressive', 'indic'} else '.venv') / ('Scripts/python.exe' if sys.platform == 'win32' else 'bin/python')
        print(f'Checking {profile}...', flush=True)
        try:
            command = [str(python), str(Path(__file__)), '--probe', profile]
            if args.packages_only: command.append('--packages-only')
            result = subprocess.run(command, cwd=ROOT,
                                    capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=120)
            report = json.loads(result.stdout)
            if report['errors']:
                failures += 1
                for error in report['errors']:
                    print(f'  FAIL {error}', flush=True)
                print(f'  Fix: {FIXES[profile]}', flush=True)
            else:
                hardware = report.get('hardware')
                print(f"  OK {profile}" + (f" | {hardware['device']} | {hardware['cpuThreads']} CPU threads" if hardware else ''), flush=True)
        except (OSError, subprocess.TimeoutExpired, ValueError) as exc:
            failures += 1
            print(f'  FAIL {type(exc).__name__}. Fix: {FIXES[profile]}', flush=True)
    print('Checks passed.' if not failures else f'{failures} profile(s) need attention.', flush=True)
    sys.exit(1 if failures else 0)
