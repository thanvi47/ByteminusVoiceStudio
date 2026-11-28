# ByteminusVoiceStudio — source distribution

## v0.2.2

- Recording/project titles and audio/SRT filenames use the first six script words plus `bn` or `en`.
- Studio, Playground and cloned generation results save audio and estimated SRT locally in browser IndexedDB. History survives reload and supports playback, download and deletion. Clearing site data removes this local history; old closed session-only clips cannot be recovered.
- Added a Mature, warm & confident expressive direction preset, requesting rich texture, gentle natural breathing and speech rhythm. It guides the model; acting quality and naturalness are not guaranteed.

## v0.2.1

- Fixed actual Windows DirectML speech failures: depthwise transposed convolution, unsupported complex FFT, inference tensors and incorrect bool/integer mask promotion. Small unsupported operators use CPU; neural decoder/transformer computation stays on GPU.
- Verified real API audio on AMD Radeon integrated graphics for Kokoro English, Mithi Bengali, Parler Jon (Excited) and Indic Aditi (Scared), including warm second requests. Other GPU models are not claimed to have been physically benchmarked.
- Isolated workers now retain one model and reuse Kokoro language pipelines, avoiding process/model reload on every batch. Worker frames, output size and deadlines are bounded; switching engines frees the old cache.
- Added reproducible `scripts/benchmark-directml.py`, numerical compatibility tests, worker lifecycle tests and hardware validation notes. Existing DirectML installations need a source update and restart; dependencies have not changed.
- Fixed Windows launcher shutdown so spawned Python process trees do not keep serving old code; added a version check and a project-scoped `scripts/stop-neural.ps1` recovery command.

## v0.2.0

- Added probed CUDA, ROCm, Intel XPU and Apple MPS device selection, with installer flags for each supported platform.
- Added an isolated experimental Windows DirectML environment for AMD/Intel DirectX 12 adapters. Local GPU speech operators failed; same-model CPU fallback generated Bengali and English audio. DirectML acceleration is not verified.
- Added automatic same-model CPU retry, backend/fallback diagnostics, and a studio status that distinguishes detection from actual generation.
- Added hardware compatibility and update instructions in `HARDWARE.bn.md`. Intel Mac native neural installation remains unsupported by the pinned Torch wheel.
- Verified web tests, hardware/protocol tests, production build and local package checks. Hardware-specific speech benchmarks require the corresponding GPU; mock selection tests do not establish GPU audio quality or speed.

> Hardware update: automatic CPU/CUDA/ROCm/XPU/MPS selection and experimental Windows DirectML. GPU tensor detection does not verify speech. **[Compatibility, tested limits and update commands](HARDWARE.bn.md)**.

Free local Bengali/English text to speech with Mithi, Kokoro, English Parler and optional Bengali Indic Parler, WAV/MP3 export, estimated SRT, voice directions, CPU/CUDA selection and optional consent-based voice cloning.

## Download and install on Windows

Download **ByteminusVoiceStudio-source.zip**, extract it, and open PowerShell inside the extracted `ByteminusVoiceStudio` folder. Install Node.js 22, Git and the Windows Visual C++ x64 runtime first. Run:

```powershell
./scripts/setup.ps1
npm run dev
```

For all optional features, approve Indic model access in your own Hugging Face account first and use `./scripts/setup.ps1 -All`. Full Bengali instructions: **docs/INSTALL.bn.md** inside the archive or the repository. Optional cloning weights have noncommercial/community terms; read THIRD_PARTY_NOTICES.md.

## macOS Apple Silicon / Ubuntu Linux

Install Node.js 22+ and the native audio/build dependencies described in **docs/INSTALL.mac-linux.bn.md**, then run:

```bash
bash scripts/setup.sh
npm run dev
```

`bash scripts/setup.sh --all` includes optional models after your own HF approval. Apple Silicon macOS probes MPS with CPU fallback; Intel macOS is unsupported by the pinned PyTorch wheel. Ubuntu/Linux supports CPU and compatible NVIDIA CUDA. Windows DirectML is experimental; AMD RX 570 may fall back to CPU. Supported Linux AMD GPUs can use ROCm. Unix CI checks package installation/imports without model downloads; those checks are not full neural-generation benchmarks.

The ZIP contains tracked source, dependency locks, setup/download scripts, documentation and generic demo samples. **Python environments, node_modules, multi-GB model weights, credentials and private recordings are not included.** Setup downloads them separately as needed. Synthesis needs the local Python service on the same computer. This is a source package, not a standalone Windows executable.

CPU workflows have been exercised locally. GPU selection is implemented but RTX 5090 inference was not directly benchmarked on the CPU-only test machine. Emotional acting varies and SRT timing is estimated. No paid inference provider is required.

The release body includes a SHA256 checksum for the attached source ZIP. Release badges count asset download events; repeat downloads and bots may affect totals. This release attaches only the source ZIP, so the count represents ZIP downloads. It does not measure unique users, installations or active use. No in-app usage telemetry is enabled.

For updates, Git clones can use `git pull --ff-only`; extracted ZIP installations should download/extract the new source release, rerun setup, and retain private data/model folders separately. Do not overwrite private files with shared data.
