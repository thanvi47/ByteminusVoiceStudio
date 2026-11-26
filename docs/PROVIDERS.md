# Free speech provider

The only configured engine is eSpeak NG via `@echogarden/espeak-ng-emscripten`. It synthesizes on CPU within Node.js, without internet requests after dependencies are installed. It supports Bengali and English. `+f3` is an actual eSpeak voice variant, not a recording or fabricated human voice.

Bengali is generic; this app makes no claim of separate Bangladesh or Indian accents. English exposes US and UK voice configurations. All delivery presets approximate rate and pitch. No voices support native emotional acting here. Some presets intentionally share conservative delivery mappings.

Azure, Google Cloud, unofficial Edge TTS wrappers and paid neural services are omitted to honor the free-only requirement. There are no trial credits, provider keys, cloud billing dependencies or hidden fallbacks. Hardware and hosting still have their own costs.

Future local neural models can implement `TTSProvider`; confirm code and weight licenses, Bengali coverage and CPU/GPU requirements before adoption. Python can be introduced for a local neural service later; it is not required by this version. Do not offer voice cloning without explicit consent.
