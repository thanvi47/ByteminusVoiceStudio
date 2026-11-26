# Architecture

The App Router renders a browser studio. Route Handlers provide auth and TTS APIs on the Node.js runtime. `lib/script.ts` owns Zod validation, pause parsing, language detection, XML escaping, delivery maps and estimated subtitle export. `lib/tts.ts` lazily initializes the eSpeak NG Emscripten engine. The engine is a server external dependency so its data file resolves correctly.

Synthesis uses a serialized queue because eSpeak is mutable. At most three requests can enter the running/waiting set. Script pieces synthesize sequentially; breaks become exactly sized 22,050 Hz PCM silence. Text is XML escaped before entering the engine. PCM is written to WAV or encoded with LAME JS into MP3. Peaks are calculated from real audio. No shell, binary subprocess or paid service is involved.

The studio calls an authenticated API, receives an audio Blob and uses an object URL for playback. Generated clips retain a snapshot of their original text for SRT export, independent of later edits. Object URLs are revoked when deleted or on unmount. Audio history is in memory; localStorage holds at most 50 saved script projects and one saved draft.

Authentication uses HMAC-SHA256 tokens with random nonce and 24-hour expiry. Cookies are HttpOnly, SameSite=Lax and Secure in production. Production rejects unconfigured auth. Local development can bypass auth only without APP_ACCESS_PASSWORD. POST requests reject conflicting Origin headers. Input is bounded and request quotas are process-local, appropriate for one private single-instance studio. A public multi-instance service needs distributed limiting and stronger identity before exposure.

The provider interface is intentionally small. Future neural adapters should declare voice, locale, license, native-style and export capabilities explicitly. No fake provider fallback is implemented. Model weights and their licenses require separate review. No persistent server filesystem or database is required.
