# Architecture

The App Router renders the studio. Authenticated Next.js Route Handlers validate Zod input, allowlist voices, and invoke either loopback Python neural synthesis or an explicitly selected legacy eSpeak voice. lib/script.ts owns parsing/delivery/SRT; lib/voice-catalog.json is shared with Python.

```text
Browser -> authenticated Next.js route -> loopback Python
                                         |- Mithi (Bangla)
                                         |- Kokoro (US/UK)
                                         |- isolated Parler worker (English style)
        <- WAV/MP3 export <- PCM + actual sample rate
```

Mithi/Kokoro load lazily. One neural synthesis runs at a time. Parler and DirectML use isolated environments connected through bounded private stdio frames, without another HTTP listener. Each worker caches one engine; switching engines releases the previous model, while switching to a main-process model closes the isolated workers. Subsequent batches reuse weights and Kokoro language pipelines. Resident GPU models do not repeat the cold-load free-memory threshold. Timeouts and broken frames terminate the worker process tree; the next request can restart it. Subprocess/model paths are fixed, not derived from arbitrary commands or client URLs. Downloads occur during explicit setup.

Before starting the separate voice-cloning model, the authenticated Next.js route requests cache release from the existing loopback speech service. The release route uses the same browser/host restrictions and rejects release while generation is active. Unused parent-process GPU allocations are also released when switching engines. This avoids retaining a large expressive model alongside the cloning model.

Python validates input, inserts exact PCM pauses, applies engine-specific delivery and returns mono PCM16 at 24 kHz. Parler is resampled to 24 kHz. Next preserves sample rate in WAV/LAME MP3 and computes actual amplitude peaks. Output is capped at 90 seconds; expressive input at 600 characters. Subtitle timing is estimated.

Legacy eSpeak remains serialized and optional. Neural failure never substitutes legacy speech. Browser projects are capped at 50; clips stay temporary object URLs. Original clip text is preserved for SRT. Process usage/abuse counters reset on restart.

Production auth uses HMAC-SHA256, random nonce, 24-hour expiry and HttpOnly/SameSite=Lax/Secure cookies, failing closed without configuration. Local Python binds loopback and rejects browser origins/fetch headers and unexpected Host values. This is a private single-user setup; public replicas require stronger identity, distributed limiting and persistent accounting.
