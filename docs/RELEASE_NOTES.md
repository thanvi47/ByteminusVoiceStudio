# ByteminusVoiceStudio — source distribution

Free local Bengali/English text to speech with Mithi, Kokoro, English Parler and optional Bengali Indic Parler, WAV/MP3 export, estimated SRT, voice directions, CPU/CUDA selection and optional consent-based voice cloning.

## Download and install on Windows

Download **ByteminusVoiceStudio-source.zip**, extract it, and open PowerShell inside the extracted `ByteminusVoiceStudio` folder. Install Node.js 22, Git and the Windows Visual C++ x64 runtime first. Run:

```powershell
./scripts/setup.ps1
npm run dev
```

For all optional features, approve Indic model access in your own Hugging Face account first and use `./scripts/setup.ps1 -All`. Full Bengali instructions: **docs/INSTALL.bn.md** inside the archive or the repository. Optional cloning weights have noncommercial/community terms; read THIRD_PARTY_NOTICES.md.

The ZIP contains tracked source, dependency locks, setup/download scripts, documentation and generic demo samples. **Python environments, node_modules, multi-GB model weights, credentials and private recordings are not included.** Setup downloads them separately as needed. Synthesis needs the local Python service on the same computer. This is a source package, not a standalone Windows executable.

CPU workflows have been exercised locally. GPU selection is implemented but RTX 5090 inference was not directly benchmarked on the CPU-only test machine. Emotional acting varies and SRT timing is estimated. No paid inference provider is required.

The release body includes a SHA256 checksum for the attached source ZIP. Release badges count asset download events; repeat downloads and bots may affect totals. This release attaches only the source ZIP, so the count represents ZIP downloads. It does not measure unique users, installations or active use. No in-app usage telemetry is enabled.

For updates, Git clones can use `git pull --ff-only`; extracted ZIP installations should download/extract the new source release, rerun setup, and retain private data/model folders separately. Do not overwrite private files with shared data.
