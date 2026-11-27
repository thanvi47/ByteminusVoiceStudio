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

```json
{"text":"Hello [pause 500ms] world.","voice":"kokoro:af_heart","emotion":"Neutral","intensity":50,"rate":1,"pitch":1,"format":"wav","style":""}
```

Text: 1–3,000 characters, with Parler/Indic expressive voices limited to 600; pauses: 0–10 seconds, at most 30; output: at most 90 seconds. Voice IDs are allowlisted by `/api/tts/voices` and `lib/voice-catalog.json`: e.g. `mithi:charvi`, `kokoro:af_heart`, `parler:Jon`. Legacy IDs remain explicit options. Rate: 0.5–2; pitch: 0.5–1.5; intensity: 0–100. Mithi/Kokoro approximate delivery through pitch/rate. Parler/Indic interpret emotion and freeform direction; `style` accepts up to 1,200 characters. Their numeric speed/pitch sliders are applied to audio after generation. Exact prompt response is not guaranteed.

The voices response includes `neural.engines`, reporting installed model files. Neural inference goes to a fixed loopback-only Python service; no client-provided provider URL, arbitrary subprocess command or paid service is accepted. Failures never fall back to robotic audio. Local CPU requests can take minutes; hosted serverless runtime compatibility is not promised.

Success headers: `Content-Type: audio/wav` or `audio/mpeg`, attachment filename, `Cache-Control: no-store`, `X-Audio-Duration` in seconds and `X-Audio-Peaks` as 100 amplitude values. Errors include 400 validation, 401 authentication, 403 origin mismatch, 413 body size, 429 abuse limit and 503 engine unavailable/busy. Login allows 10 attempts/minute and synthesis 12 requests/minute per server process; process restarts reset limits.
