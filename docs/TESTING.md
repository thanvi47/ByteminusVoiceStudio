# Verification

```powershell
npm test
npm run typecheck
npm run build
npm audit
```

Vitest covers language detection, request validation, escaped markup, malformed pause rejection, pause limits, intensity mapping, SRT output, signed-session tampering, production fail-closed auth, rate limiting and cross-origin checks. Actual eSpeak NG tests generate real PCM in all six voice configurations and encode an MP3. These tests are not mocked audio or simulated provider success. Exact silence duration is checked against sample rate.

Browser smoke tests run with `npm run test:browser` after installing Chromium with `npx playwright install chromium`. They exercise real UI generation/download, local project restore and mobile overflow. Production API tests can separately verify authentication with test-only environment secrets. Never commit real credentials.

During implementation, browser checks were performed through the connected Chrome using Playwright locators: real Bengali generation (14.5 seconds), waveform/player rendering, save/open project and mobile layout (no horizontal overflow). The reusable Playwright runner specs are provided but were not executed in this environment. The browser download-event wait timed out; the audio API payload itself is covered by integration tests. No Vercel deployment was performed.

Provider failures return safe messages. Cloud quota errors are inapplicable because there is no cloud speech provider. Hosted deployment and subjective audio quality require additional live review on the target platform. SRT remains estimated; tests do not claim precise speech alignment.
