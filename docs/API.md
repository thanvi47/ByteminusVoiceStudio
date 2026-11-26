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

Synthesis JSON:

```json
{"text":"Hello [pause 500ms] world.","voice":"en-us","emotion":"Neutral","intensity":50,"rate":1,"pitch":1,"format":"wav"}
```

Text: 1–3,000 characters; pauses: 0–10 seconds and at most 30. Voice IDs: `bn`, `bn+f3`, `en-us`, `en-us+f3`, `en-gb`, `en-gb+f3`. Rate: 0.5–2; pitch: 0.5–1.5; intensity: 0–100. The server combines rate/pitch with approximated emotion mapping. No native acting styles exist in this engine.

Success headers: `Content-Type: audio/wav` or `audio/mpeg`, attachment filename, `Cache-Control: no-store`, `X-Audio-Duration` in seconds and `X-Audio-Peaks` as 100 amplitude values. Errors include 400 validation, 401 authentication, 403 origin mismatch, 413 body size, 429 abuse limit and 503 engine unavailable/busy. Login allows 10 attempts/minute and synthesis 12 requests/minute per server process; process restarts reset limits.
