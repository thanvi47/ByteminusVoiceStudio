# ByteminusVoiceStudio

Free, open source **local neural text-to-speech** for Bangla and English. Next.js, TypeScript and a Python CPU inference service. No paid speech APIs, subscriptions or cloud credits.

বাংলা ও ইংরেজি neural voice তৈরি করুন নিজের কম্পিউটারে।

## Voices and delivery

| Engine | Profiles | Language | Controls |
| --- | --- | --- | --- |
| Mithi v2 Flash | 10 | Bengali | Neural speech; emotion approximated with pitch/rate |
| Kokoro v1 | 28 | US/UK English | Neural speech; emotion approximated with pitch/rate |
| Parler-TTS Mini v1 | 34 named speakers | English, speaker-dependent accent | Prompted delivery and optional voice direction; results vary |
| eSpeak NG | 6 legacy configurations | Bengali/English | Robotic engine, only by explicit selection |

These are model speaker profiles, not 72 verified voice artists. Bengali regional accent is unverified. Parler directions are qualitative; exact emotion/intensity is not guaranteed. Failed neural requests **never silently fall back to eSpeak**.

## Windows setup

Install Node.js 22 and Git. In PowerShell inside this project:

```powershell
npm ci --legacy-peer-deps
./scripts/setup-neural.ps1 -Expressive
npm run dev
```

Open http://127.0.0.1:3000. Keep the terminal running. Setup installs isolated Python 3.12 environments and CPU PyTorch inside the project, and downloads several GB. Omit `-Expressive` for just Mithi/Kokoro. Model weights, caches, environments and generated samples are ignored by Git.

After setup, `npm run dev` starts/reuses both services. First generation loads the chosen model; CPU generation can take longer than the audio duration. Parler is substantially slower and limited to 600 characters per request. See [NEURAL.md](docs/NEURAL.md).

## Features

- TXT import, language detection, character/word counts, pause tags, browser-local projects and session audio history.
- WAV/MP3 export, actual waveform/duration, browser playback volume/speed.
- 22 delivery presets, intensity, speed/pitch and freeform Parler voice direction.
- Voice library with search, language, gender and engine filters.
- Explicit PCM silence via `[pause 500ms]` and `[break 1.5s]`, at most 10 seconds per break.
- Estimated sentence-level SRT; dialogue beta with per-speaker assignment and separate line clips.
- Production shared-password login, signed HttpOnly cookies, validation and bounded generation.

## Production and limitations

Set `APP_ACCESS_PASSWORD` and a random `SESSION_SECRET` of at least 32 characters in `.env.local` or the environment. Never commit or paste credentials into chat. Production fails closed without both.

```powershell
npm run build
npm run start:studio
```

Use a trusted HTTPS reverse proxy for production secure cookies. Python must stay on loopback port 8123. Development without a password is allowed only outside production. See [deployment](docs/DEPLOYMENT.md).

Neural mode targets a local/self-hosted computer, not an ordinary Vercel function. Free software does not include free hosting, electricity, hardware or bandwidth. Scripts are limited to 3,000 characters, 30 breaks and 90 seconds output; Parler input is capped at 600 characters. No merged dialogue, voice cloning, exact word alignment or automatic long-script assembly. Projects live in the browser; download audio before reload. Voices may mispronounce names or omit words; review before publishing.

## Tests and contributions

```powershell
npm test
npm run typecheck
npm run build
./.venv/Scripts/python.exe -m unittest neural.test_server
```

Read [CONTRIBUTING.md](CONTRIBUTING.md), [testing](docs/TESTING.md), [API](docs/API.md) and [architecture](docs/ARCHITECTURE.md). Paid providers must not become required dependencies.

```text
app/       Studio UI and authenticated API
lib/       Validation, shared voice catalog, audio export and adapters
neural/    CPU inference, isolated expressive worker and Python locks
scripts/   Setup, pinned model download and service startup
tests/     TypeScript tests and reusable browser specs
docs/      Setup, capabilities and deployment
```

## License

App: GPL-3.0-or-later. Selected neural weights/inference code: upstream Apache-2.0 releases; preserve their notices. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Model source revisions are fixed by the downloader. Some neural frontends use eSpeak for phoneme conversion; the audio decoder remains neural.
