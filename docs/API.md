# HTTP API

Errors use `{ "error": { "message": "..." } }`. Auth/session and usage responses disable caching. Do not expose this private single-user service publicly without additional abuse controls.

| Method | Route | Behavior |
| --- | --- | --- |
| GET | /api/health | Configuration health; 503 if production auth is missing |
| GET | /api/auth/session | Authentication and local-development state |
| POST | /api/auth/login | JSON `{password}`; signed session cookie, 401 or 503 on failure |
| POST | /api/auth/logout | Clear session cookie |
| GET | /api/tts/voices | Protected voice catalog and actual capabilities |
| GET | /api/tts/usage | Protected process counters; no invented provider quota |
| POST | /api/tts/generate | Protected synthesis; binary WAV or MP3 |
| GET | /api/clones | Protected local clone profiles and installation state |
| POST | /api/clones | Save `{name,transcript,consent:true,audio}`; audio is base64 mono PCM16 24 kHz WAV, 3–10 seconds |
| GET | /api/clones/[id] | Protected private reference WAV; no-store |
| DELETE | /api/clones/[id] | Delete one UUID profile and its recording |
| POST | /api/clones/generate | `{id,text,language:"bn" or "en",format:"wav" or "mp3",rate:1}`; local cloned speech |

Cloning accepts at most 600 script characters and 90 seconds output. Reference uploads are capped at 700 KB JSON and reject silence, malformed WAV headers and out-of-range durations. At most 20 profiles persist in ignored `.data/voices/`. Mutation requests require the existing authentication/origin checks. This is a single-owner studio: authenticated users share these profiles. Clone generation uses a fixed local worker with a 15-minute timeout; it does not silently substitute another voice. Responses include `X-Audio-Duration`; the browser builds estimated SRT from the submitted script snapshot. Optional OmniVoice weights have noncommercial terms; see README.

Synthesis JSON:

`outputGain` accepts 0–3 (default 1); `normalizeAudio` defaults to true. Both `/api/tts/generate` and `/api/clones/generate` apply these controls to PCM before encoding WAV/MP3. Level processing preserves sample count and SRT duration, excludes quiet gaps from its speech-level estimate, limits automatic gain to 8× and smoothly limits processed peaks to 95% full scale. It is RMS correction, not a LUFS guarantee. The browser's separate playback gain is not sent to the API. Voice catalog entries include `delivery.label`, `delivery.emotion` and a description of an editable app suggestion.

```json
{"text":"Hello [pause 500ms] world.","voice":"kokoro:af_heart","emotion":"Neutral","intensity":50,"rate":1,"pitch":1,"format":"wav","style":""}
```

Neural text: 1–3,000 CPU characters, 6,000 on smaller usable CUDA GPUs or 12,000 on CUDA GPUs with at least 16 GB VRAM. Runtime limits are enforced server-side. Long scripts use sequential hardware-sized batches joined before mastering/encoding. Pauses: 0–10 seconds, at most 30; joined neural output: at most 10 minutes on CPU or 30 on CUDA. Legacy output keeps its 3,000-character/90-second cap; cloning is separate. Voice IDs are allowlisted by `/api/tts/voices` and `lib/voice-catalog.json`: e.g. `mithi:charvi`, `kokoro:af_heart`, `parler:Jon`. Legacy IDs remain explicit options. Rate: 0.5–2; pitch: 0.5–1.5; intensity: 0–100. Mithi/Kokoro emotion effects are disabled; only explicit manual speed/pitch controls apply. Parler/Indic interpret emotion and freeform direction; `style` accepts up to 1,200 characters. Their numeric speed/pitch sliders are applied to audio after generation. Exact prompt response is not guaranteed.

The voices response includes `neural.engines` and per-environment `neural.engineHardware` with device, thread count, VRAM and batch/script budgets. Setup and troubleshooting: [INSTALL.bn.md](INSTALL.bn.md). Neural inference goes to a fixed loopback-only Python service; no client-provided provider URL, arbitrary subprocess command or paid service is accepted. Failures never fall back to robotic audio. Local CPU requests can take minutes; hosted serverless runtime compatibility is not promised.

Success headers: `Content-Type: audio/wav` or `audio/mpeg`, attachment filename, `Cache-Control: no-store`, `X-Audio-Duration` in seconds and `X-Audio-Peaks` as 100 amplitude values. Errors include 400 validation, 401 authentication, 403 origin mismatch, 413 body size, 429 abuse limit and 503 engine unavailable/busy. Login allows 10 attempts/minute and synthesis 12 requests/minute per server process; process restarts reset limits.
