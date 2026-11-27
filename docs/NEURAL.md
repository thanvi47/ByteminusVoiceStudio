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

Models load lazily. Mithi/Kokoro remain loaded for warm requests. Parler releases those models, starts an isolated worker and exits the worker after each batch to reclaim RAM. CPU Parler may take minutes for a short sentence. The editor now accepts 3,000 characters on CPU, 6,000 on usable CUDA GPUs with less than 16 GB VRAM, or 12,000 on larger GPUs. Sequential batches use 160/240/300 characters for small/medium/larger CPU thread budgets and 600/1,200 for CUDA. The decoder retains its safe 160-character internal sections and token budget. All batches join before loudness processing, WAV/MP3 encoding and estimated SRT timing. A failure stops the request rather than returning partial audio as a complete script. Each batch has a 20-minute deadline; a long CPU script can take substantially longer overall. Joined neural audio is bounded at 10 minutes on CPU and 30 minutes on CUDA.

Setup uses NVIDIA driver detection to select official PyTorch 2.8.0 CPU or CUDA 12.8 wheels for both environments. `./scripts/setup-neural.ps1 -Expressive -Device cuda` upgrades an existing CPU-only installation for NVIDIA; `-Device cpu` forces CPU packages. RTX 5090 requires compatible CUDA kernels and driver, not just a detected GPU name. Runtime probes CUDA availability, free VRAM (at least 6 GB) and a small matrix operation before choosing it. Invalid kernels or insufficient free VRAM fall back to CPU with a reported reason; explicit `BYTEMINUS_DEVICE=cuda` instead fails clearly. `BYTEMINUS_DEVICE=cpu` forces CPU. Mithi, Kokoro, expressive models and cloning move their models to the selected device; these paths are not GPU-benchmarked on the current CPU-only computer. Apple MPS and Windows AMD DirectML are not enabled.

The `/health` response reports per-environment `engineHardware`, device name, VRAM, thread count and budgets; the studio header displays the active voice runtime. These are conservative capacity tiers rather than performance promises. User text is never uploaded for hardware detection or synthesis. Browser cancellation may stop waiting while an isolated batch finishes; do not resubmit until the engine is idle.

The service and expressive worker use up to 8 CPU compute threads by default (half the reported logical processors, capped at 8). This is parallelism inside model operations; autoregressive audio decoding still has sequential steps. Multiple simultaneous model copies would consume much more RAM. A Ryzen 7 PRO 5850U fixed 65-token Indic benchmark measured 10.41s with 4 threads, 9.30s with 8, and 10.98s with 16. This is a short benchmark, not a guaranteed whole-script speedup. Decoder SDPA was slower on this machine, so eager attention is retained.

To override the thread budget, set `$env:BYTEMINUS_CPU_THREADS="8"` in PowerShell before starting `npm run dev`; restart the existing neural server to apply it. Valid positive values are capped at the reported logical processor count. `/health` on port 8123 reports `cpuThreads` and `logicalProcessors`. This variable is read from the process environment, not from Next.js `.env.local`.

Initial setup needs internet. Synthesis uses local weights and Hugging Face offline mode. Unknown English words may use bundled eSpeak for phonemes, while waveform generation stays neural. No paid/third-party inference service is contacted.

## Linux / macOS

See the complete [macOS / Linux / Ubuntu guide](INSTALL.mac-linux.bn.md) for native prerequisites, optional features and troubleshooting. Apple Silicon macOS uses CPU; Intel macOS is unsupported by the pinned PyTorch 2.8 wheel. Linux targets glibc systems such as Ubuntu 22.04/24.04. The shared lock marks win32-setctime as Windows-only.

```sh
bash scripts/setup.sh
npm run dev
```

English expressive mode is included. Use `bash scripts/setup.sh --all` for all optional features after approving HF Indic access. Unix CI installs/packages/imports without model weights; that check is separate from real model-generation verification. Windows CPU generation is tested; Linux/macOS generation and GPU performance are not claimed from a package-only check.

## Troubleshooting

- Page unavailable: run npm run dev in this project and keep its terminal open.
- Engine unavailable: finish setup, restart services and reload the page. There is no robotic substitution.
- Slow first generation: imports/model loading and audio-processing compilation can take tens of seconds. Parler CPU can take minutes; start with a short sentence.
- Expressive failure: inspect the neural terminal log. The worker uses eager attention, Transformers 4.46.1, and matching torch/torchaudio 2.8.0.
- Busy: only one neural synthesis runs at a time; wait for completion.
- Poor output: try another voice, shorter text and a more conservative direction. Bengali regional accent and exact emotional acting are not guaranteed.
- Moved project: rerun setup; Python environments contain interpreter paths.

npm run dev:web starts only Next.js; npm run neural:serve starts only Python. npm run start:studio starts production services after a build. Do not expose Python port 8123 publicly.
