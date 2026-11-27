# Local neural engines

Choose Bengali for Mithi (10 profiles), US/UK English for Kokoro (28 profiles), or English expressive speakers for Parler (34 names). These are synthetic model profiles, not a claim of 72 verified voice artists.

Mithi/Kokoro cannot perform emotional acting; automatic emotion effects are disabled. Parler/optional Indic Parler receive descriptive speaker/emotion prompts with variable results. Their numeric speed/pitch sliders use audio processing after generation. Intensity is a qualitative model direction: 0% uses a neutral prompt and ignores conflicting vibe directions, 1–34% requests restrained acting, and higher values request stronger expression. Changing emotion or vibe preserves your intensity; explicit demo recipes may load their own settings. Pause durations remain unchanged. Optional local OmniVoice cloning uses its separate sidebar panel; see the README for setup and noncommercial model terms.

## Windows

```powershell
./scripts/setup-neural.ps1 -Expressive
npm run dev
```

The script uses official Astral uv 0.13.10, isolated Python 3.12, CPU PyTorch 2.8.0 and checked-in dependency locks. Parler has a separate environment because its Transformers version conflicts with Mithi. Omit `-Expressive` to avoid the approximately 3.5 GB Parler model. Reserve several GB for packages/caches beyond weights.

Downloads use pinned revisions. Completed files are reused; interrupted files download again through a .partial file. Each model folder records source.json. Selected releases require no Hugging Face login. The gated Indic Parler model is not downloaded or bypassed.

## Runtime

Next.js listens on 127.0.0.1:3000; Python on 127.0.0.1:8123. Only Next.js calls the neural service. Python rejects Origin/Sec-Fetch browser headers and unexpected Host values. It must remain loopback-only; this does not isolate it from other software on the computer.

Models load lazily. Mithi/Kokoro remain loaded for warm requests. Parler releases those models, starts an isolated worker and exits the worker after generation to reclaim RAM. CPU Parler may take minutes for a short sentence. Limit expressive requests to 600 characters. Generated output is capped at 90 seconds.

The service and expressive worker use up to 8 CPU compute threads by default (half the reported logical processors, capped at 8). This is parallelism inside model operations; autoregressive audio decoding still has sequential steps. Multiple simultaneous model copies would consume much more RAM. A Ryzen 7 PRO 5850U fixed 65-token Indic benchmark measured 10.41s with 4 threads, 9.30s with 8, and 10.98s with 16. This is a short benchmark, not a guaranteed whole-script speedup. Decoder SDPA was slower on this machine, so eager attention is retained.

To override the thread budget, set `$env:BYTEMINUS_CPU_THREADS="8"` in PowerShell before starting `npm run dev`; restart the existing neural server to apply it. Valid positive values are capped at the reported logical processor count. `/health` on port 8123 reports `cpuThreads` and `logicalProcessors`. This variable is read from the process environment, not from Next.js `.env.local`.

Initial setup needs internet. Synthesis uses local weights and Hugging Face offline mode. Unknown English words may use bundled eSpeak for phonemes, while waveform generation stays neural. No paid/third-party inference service is contacted.

## Linux / macOS

Python startup paths support these platforms, but the checked-in lockfiles reflect the tested Windows environment. Install Python 3.12 and uv, create .venv, install the platform-supported CPU PyTorch 2.8.0 wheel, then the base lockfile. Omit Windows-only win32-setctime if required. Use the platform's official PyTorch installation instructions on macOS.

```sh
uv venv .venv --python 3.12
uv pip install --python .venv/bin/python torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu
uv pip install --python .venv/bin/python -r neural/requirements.lock.txt
.venv/bin/python scripts/download-models.py mithi kokoro
npm run dev
```

For expressive mode create .runtime/parler-env, install matching CPU torch/torchaudio 2.8.0 plus neural/parler.lock.txt there, then run scripts/download-models.py parler. Linux/macOS setup has not been executed here.

## Troubleshooting

- Page unavailable: run npm run dev in this project and keep its terminal open.
- Engine unavailable: finish setup, restart services and reload the page. There is no robotic substitution.
- Slow first generation: imports/model loading and audio-processing compilation can take tens of seconds. Parler CPU can take minutes; start with a short sentence.
- Expressive failure: inspect the neural terminal log. The worker uses eager attention, Transformers 4.46.1, and matching torch/torchaudio 2.8.0.
- Busy: only one neural synthesis runs at a time; wait for completion.
- Poor output: try another voice, shorter text and a more conservative direction. Bengali regional accent and exact emotional acting are not guaranteed.
- Moved project: rerun setup; Python environments contain interpreter paths.

npm run dev:web starts only Next.js; npm run neural:serve starts only Python. npm run start:studio starts production services after a build. Do not expose Python port 8123 publicly.
