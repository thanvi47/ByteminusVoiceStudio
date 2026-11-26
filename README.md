# ByteminusVoiceStudio

A free, open source Bengali and English speech studio built with Next.js, React and TypeScript. Runs locally with eSpeak NG compiled to JavaScript. **No paid speech APIs, API keys, credit card, Docker, Python or model downloads required.**

বাংলা ও ইংরেজি লেখা থেকে অডিও তৈরি করুন। কোনো paid API লাগে না।

## Run locally

Install Node.js 22 LTS and Git, then in this project:

```powershell
npm ci --legacy-peer-deps
npm run dev
```

Open http://127.0.0.1:3000. The development server binds to loopback. Development without a password permits local access; production always requires authentication configuration.

## Features

- Bengali (generic), US English and UK English, with masculine/feminine synthetic variants.
- Actual offline synthesis, WAV (mono PCM 22.05 kHz) and MP3 (96 kbps) exports.
- Script import, character and word counts, language detection, clear, project save and TXT export. Native textarea editing provides undo/redo and paste.
- 22 delivery presets and intensity, speed and pitch controls. Delivery is approximated through rate/pitch; voices have no native emotional acting.
- `[pause 500ms]`, `[break 1.5s]`, and custom breaks up to 10 seconds, inserted as PCM silence. Tags are not spoken.
- Audio playback, volume via browser player, playback rate, actual amplitude waveform and duration.
- Estimated sentence-level SRT export; not word alignment.
- Voice search and filters, local browser projects, temporary session audio history, light/dark appearance.
- Dialogue beta: speaker voice assignment and individual line generation. Each line is a separate clip.
- Shared-password login, signed HttpOnly cookies, production fail-closed configuration, validation, bounded text and process-level abuse limits.

## Honest limits

eSpeak NG produces classic synthesized speech. It is **not a neural AI voice model**, a clone of a person, or studio-quality expressive acting. Bengali has no verified Bangladesh/India accent separation. Variants are synthetic voice configurations, not different human speakers. Advanced sentence editing, merged dialogue, native emotions, normalization, cloud providers and local neural models remain future work.

Scripts are capped at 3,000 characters, 30 breaks and 90 seconds of generated audio per request (WAV stays under 4 MB). There is no automatic long-script chunking yet. Generate shorter sections. Projects persist only in this browser; audio history disappears on reload. Download audio to retain it. Process counters reset on restart. Hosting, electricity, hardware, bandwidth and domain names can have costs; running on an existing computer avoids cloud subscription fees.

## Production

Copy `.env.example` to `.env.local` and set:

```dotenv
APP_ACCESS_PASSWORD=your-long-private-password
SESSION_SECRET=at-least-32-random-characters
```

Generate a secret locally using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Never commit credentials or paste them into chat.

```powershell
npm run build
npm start
```

Production cookies require HTTPS; terminate TLS with a local/self-hosted reverse proxy for production access. For normal localhost use, use `npm run dev`. See [deployment](docs/DEPLOYMENT.md) before public hosting.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). All new runtime functionality must work without a paid service. Do not add billing-dependent speech providers as a core requirement. Do not submit secrets, generated recordings or text without permission.

```powershell
npm test
npm run typecheck
npm run build
```

See [testing](docs/TESTING.md), [API](docs/API.md), [architecture](docs/ARCHITECTURE.md) and [providers](docs/PROVIDERS.md).

## Source layout

```text
app/                 Studio UI, styles and server route handlers
app/api/auth/        Login, logout and session
app/api/tts/         Voices, usage and synthesis
lib/                 Script parsing, authentication, audio and engine adapter
tests/               Unit and real synthesis integration tests
docs/                Setup, deployment and technical documentation
types/               Engine module declarations
```

## License

GPL-3.0-or-later; see [LICENSE](LICENSE). eSpeak NG/Emscripten and LAME dependencies retain their upstream notices. When distributing software, preserve the license notices and provide corresponding source as required by their licenses. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
