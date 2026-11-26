# Local provider capabilities

| Engine | Source | License | App profiles | Emotion |
| --- | --- | --- | --- | --- |
| Mithi v2 Flash | https://huggingface.co/Oomni/mithi-v2-flash | Apache-2.0 | 10 Bengali | F0/rate approximation, no native acting |
| Kokoro v1 | https://huggingface.co/hexgrad/Kokoro-82M | Apache-2.0 | 20 US + 8 UK English | Speed/pitch approximation |
| Parler-TTS Mini v1 | https://huggingface.co/parler-tts/parler-tts-mini-v1 | Apache-2.0 | 34 named English speakers | Prompted style, variable results |
| eSpeak NG Emscripten | https://github.com/echogarden-project/espeak-ng-emscripten | GPL-3.0 | 6 legacy configurations | Classic robotic speech |

IDs are allowlisted in lib/voice-catalog.json: e.g. mithi:charvi, kokoro:af_heart, parler:Jon. Parler's published names lack a reliable gender/accent table, so the catalog leaves these unspecified/speaker-dependent. Bengali regional accent is unverified.

No neural-to-robotic fallback occurs. Unavailable models are marked and requests fail explicitly. Installed-file health is not a promise that every speaker/style was auditioned. Weights are downloaded separately at pinned revisions, never embedded in Git.

The gated AI4Bharat Indic Parler model was researched but not included; its access conditions were not bypassed. Qwen3-TTS offers instruction control but is not installed in this CPU-focused version. No cloning is exposed. Free model licenses do not include cloud hosting or electricity.
