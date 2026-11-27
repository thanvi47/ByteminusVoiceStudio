# Third-party notices

This project uses free and open source software. The npm lockfile records exact transitive versions.

| Component | License | Source |
| --- | --- | --- |
| eSpeak NG | GPL-3.0-or-later | https://github.com/espeak-ng/espeak-ng |
| eSpeak NG Emscripten package | GPL-3.0 | https://github.com/echogarden-project/espeak-ng-emscripten |
| @breezystack/lamejs / LAME | LGPL-3.0 | https://github.com/shijinyu/lamejs |
| Next.js | MIT | https://github.com/vercel/next.js |
| React | MIT | https://github.com/facebook/react |
| Zod | MIT | https://github.com/colinhacks/zod |
| Lucide | ISC | https://github.com/lucide-icons/lucide |
| TypeScript | Apache-2.0 | https://github.com/microsoft/TypeScript |
| Vitest | MIT | https://github.com/vitest-dev/vitest |
| Playwright | Apache-2.0 | https://github.com/microsoft/playwright |
| Mithi v2 Flash | Apache-2.0 | https://huggingface.co/Oomni/mithi-v2-flash |
| Kokoro-82M v1 | Apache-2.0 | https://huggingface.co/hexgrad/Kokoro-82M |
| Parler-TTS Mini v1 / inference | Apache-2.0 | https://github.com/huggingface/parler-tts |
| PyTorch | BSD-3-Clause | https://github.com/pytorch/pytorch |
| Transformers | Apache-2.0 | https://github.com/huggingface/transformers |
| FastAPI | MIT | https://github.com/fastapi/fastapi |
| OmniVoice inference code (optional) | Apache-2.0 | https://github.com/k2-fsa/OmniVoice |
| OmniVoice pretrained weights (optional, downloaded separately) | CC-BY-NC per upstream model card | https://huggingface.co/k2-fsa/OmniVoice |
| Bundled Higgs Audio v2 tokenizer (optional, downloaded separately) | Boson Higgs Audio 2 Community License | https://huggingface.co/k2-fsa/OmniVoice/blob/main/audio_tokenizer/LICENSE |

The cloning engine's weight licenses differ from its code license. Free noncommercial use does not imply unrestricted commercial rights or an OSI-approved weight license. The app does not redistribute these weights. Its generic committed voice previews use Mithi/Kokoro/Parler only. Private clone recordings and generated cloning test audio must never be committed.

Upstream copyright and full licenses are included in installed packages and downloaded model folders. Python transitive dependencies retain their licenses; inspect installed metadata and checked-in locks. Preserve upstream notices and corresponding-source obligations when redistributing software or engine binaries. Neural weights are downloaded separately and not committed. Mithi includes Kokoro and Maya text-normalization code; retain the credits in its README and LICENSE.
