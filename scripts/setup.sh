#!/usr/bin/env bash
# macOS Apple Silicon / glibc Linux. No sudo, remote shell piping or paid services.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ALL=0; INDIC=0; CLONING=0; TRANSCRIPTION=0; SKIP_MODELS=0; SKIP_WEB=0; DEVICE=auto
usage() {
  printf '%s\n' 'Usage: bash scripts/setup.sh [--all] [--bengali-expressive] [--cloning] [--transcription] [--device auto|cpu|cuda|rocm|xpu|mps]' \
    'Default: base Mithi/Kokoro + English Parler. --all adds Indic, cloning and transcription.' \
    'Devices: auto, cpu, cuda (NVIDIA Linux), rocm (AMD Linux), xpu (Intel), mps (Apple). Windows DirectML uses setup-directml.ps1.' \
    'CI only: --skip-models --skip-web (checks packages, NOT ready-to-generate models).'
}
while [ "$#" -gt 0 ]; do
  case "$1" in
    --all) ALL=1; INDIC=1; CLONING=1; TRANSCRIPTION=1 ;;
    --bengali-expressive) INDIC=1 ;;
    --cloning) CLONING=1 ;;
    --transcription) TRANSCRIPTION=1 ;;
    --skip-models) SKIP_MODELS=1 ;;
    --skip-web) SKIP_WEB=1 ;;
    --device) shift; DEVICE="${1:?--device needs auto, cpu or cuda}" ;;
    --help|-h) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n' "$1" >&2; usage; exit 1 ;;
  esac
  shift
done
case "$DEVICE" in auto|cpu|cuda|rocm|xpu|mps) ;; *) printf 'Invalid device\n' >&2; exit 1 ;; esac
OS="$(uname -s)"; ARCH="$(uname -m)"
case "$OS/$ARCH" in
  Darwin/arm64) UV_TARGET=aarch64-apple-darwin ;;
  Darwin/x86_64) printf 'Intel macOS is unsupported by the pinned PyTorch 2.8 neural stack. Use Apple Silicon macOS or Linux x86_64; do not downgrade Torch in place.\n' >&2; exit 1 ;;
  Linux/x86_64) UV_TARGET=x86_64-unknown-linux-gnu ;;
  Linux/aarch64) UV_TARGET=aarch64-unknown-linux-gnu ;;
  *) printf 'Unsupported platform: %s/%s\n' "$OS" "$ARCH" >&2; exit 1 ;;
esac
if [ "$OS" = Darwin ] && [ "$DEVICE" != auto ] && [ "$DEVICE" != cpu ] && [ "$DEVICE" != mps ]; then printf 'macOS supports mps, cpu or auto in this installer.\n' >&2; exit 1; fi
if [ "$OS" = Linux ] && [ "$DEVICE" = mps ]; then printf 'MPS requires macOS.\n' >&2; exit 1; fi
for tool in node npm git curl tar; do
  command -v "$tool" >/dev/null 2>&1 || { printf 'Missing %s. Follow docs/INSTALL.mac-linux.bn.md prerequisites.\n' "$tool" >&2; exit 1; }
done
node -e 'if(Number(process.versions.node.split(".")[0])<22) throw new Error("Install Node.js 22+")'
export UV_CACHE_DIR="$ROOT/.cache/uv"
export UV_PYTHON_INSTALL_DIR="$ROOT/.runtime/python-unix"
UV="$ROOT/.tools/uv-unix/uv"
if [ ! -x "$UV" ]; then
  mkdir -p "$ROOT/.tools/uv-unix"
  curl --fail --location --retry 3 "https://github.com/astral-sh/uv/releases/download/0.13.10/uv-${UV_TARGET}.tar.gz" -o "$ROOT/.tools/uv-unix.tar.gz"
  tar -xzf "$ROOT/.tools/uv-unix.tar.gz" -C "$ROOT/.tools/uv-unix" --strip-components=1
fi
if [ "$SKIP_WEB" -eq 0 ]; then npm ci --legacy-peer-deps; fi
"$UV" python install 3.12 --no-bin
PYTHON="$("$UV" python find --managed-python --no-project 3.12)"
"$UV" venv --allow-existing .venv --python "$PYTHON"
"$UV" venv --allow-existing .runtime/parler-env --python "$PYTHON"
TORCH_INDEX=https://download.pytorch.org/whl/cpu
if [ "$OS" = Darwin ]; then
  TORCH_INDEX=https://pypi.org/simple
elif [ "$DEVICE" = cuda ] || { [ "$DEVICE" = auto ] && command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi --query-gpu=name --format=csv,noheader >/dev/null 2>&1; }; then
  TORCH_INDEX=https://download.pytorch.org/whl/cu128
elif [ "$DEVICE" = rocm ] || { [ "$DEVICE" = auto ] && command -v rocminfo >/dev/null 2>&1 && rocminfo >/dev/null 2>&1; }; then
  TORCH_INDEX=https://download.pytorch.org/whl/rocm6.4
elif [ "$DEVICE" = xpu ] || { [ "$DEVICE" = auto ] && command -v xpu-smi >/dev/null 2>&1; }; then
  TORCH_INDEX=https://download.pytorch.org/whl/xpu
elif [ "$ARCH" = aarch64 ]; then
  TORCH_INDEX=https://pypi.org/simple
fi
printf 'Installing PyTorch 2.8 using %s\n' "$TORCH_INDEX"
"$UV" pip install --python .venv/bin/python torch==2.8.0 --index-url "$TORCH_INDEX"
"$UV" pip install --python .venv/bin/python -r neural/requirements.lock.txt
"$UV" pip install --python .runtime/parler-env/bin/python torch==2.8.0 torchaudio==2.8.0 --index-url "$TORCH_INDEX"
"$UV" pip install --python .runtime/parler-env/bin/python -r neural/parler.lock.txt
if [ "$SKIP_MODELS" -eq 0 ]; then
  .venv/bin/python scripts/download-models.py mithi kokoro parler
  if [ "$INDIC" -eq 1 ]; then
    printf 'Approve model access first: https://huggingface.co/ai4bharat/indic-parler-tts\n'
    if ! .venv/bin/python -c 'from huggingface_hub import get_token; raise SystemExit(0 if get_token() else 1)'; then .venv/bin/hf auth login; fi
    .venv/bin/python scripts/download-models.py indic indic-description
  fi
fi
if [ "$CLONING" -eq 1 ]; then
  printf 'Optional cloning weights have noncommercial/community terms. See THIRD_PARTY_NOTICES.md.\n'
  "$UV" pip install --python .venv/bin/python torch==2.8.0 torchaudio==2.8.0 --index-url "$TORCH_INDEX"
  "$UV" pip install --python .venv/bin/python omnivoice==0.2.1 --no-deps
  "$UV" pip install --python .venv/bin/python -r neural/cloning.lock.txt
  if [ "$SKIP_MODELS" -eq 0 ]; then .venv/bin/python scripts/download-models.py omnivoice; fi
fi
if [ "$TRANSCRIPTION" -eq 1 ]; then
  "$UV" pip install --python .venv/bin/python -r neural/transcription.lock.txt
  if [ "$SKIP_MODELS" -eq 0 ]; then .venv/bin/python scripts/download-models.py whisper; fi
fi
set --
if [ "$ALL" -eq 1 ]; then set -- "$@" --all; fi
if [ "$SKIP_MODELS" -eq 1 ]; then set -- "$@" --packages-only; fi
.venv/bin/python scripts/doctor.py "$@"
if [ "$SKIP_MODELS" -eq 1 ]; then
  printf 'Package checks passed. Models were intentionally skipped: synthesis is NOT ready.\n'
else
  printf 'Setup checks passed. Run npm run dev and open http://127.0.0.1:3000.\n'
fi
