# Verification

## Delivery and volume verification

68 TypeScript tests cover normalization, manual gain/mute, peak limiting, preserved silence/duration, actual exported PCM volume, metadata suggestions and volume request bounds. Connected Chrome confirmed Jon → Excited and Emily → Calm in both studio and playground, and a generated Nicole recording played with a 300% playback boost without a browser error. The playback slider was then restored to 100%.

Two real Nicole WAV requests used the same 6.45-second script: raw output measured RMS 0.05076; auto loudness plus 200% output gain measured RMS 0.17409 (about 3.43×) with peak limited to 0.95. A cached Nicole neutral preview measured about +4.75 dB after automatic correction. All 72 generic preview entries were re-encoded from their existing PCM sources; no private recordings were published. These are signal-level measurements, not a claim of perceived loudness on every device.

## Voice playground verification

The playground update passes 61 TypeScript tests, including recipe validation, unknown/legacy voice rejection, instruction bounds and safe developer example serialization. Ten Python tests cover neural protocol controls, numeric pitch/speed and separate Indic tokenizers. Production build and typecheck pass.

Connected Chrome checks confirmed that selecting a vibe preserves the script; presets save locally; Python developer examples use the local API; recipe JSON downloads with the selected voice and script; neutral samples play without inference; and two Kokoro takes (Heart/George) remain available after navigating away and returning. A 390px viewport was checked: the added navigation initially overflowed; after wrapping the mobile navigation, document and client widths both measured 375px. Two real expressive requests with the structured directions also succeeded: Lea/Happy produced 3.49 seconds in 76.44 seconds of CPU time, and Jon/Calm produced 3.82 seconds in 96.28 seconds. These checks prove output and routing, not subjective OpenAI-equivalent quality. JSON file import validation is covered by the test suite; automated browser file import remains limited by the Chrome extension's file-access permission.

## Neural upgrade verification

The TypeScript suite includes neural catalog validation, PCM sample-rate handling, provider error propagation and a check that an offline neural service never returns legacy audio. These mocked protocol tests do not claim to generate neural audio. Python tests validate pause tags, input bounds, unknown voices and direct-browser/Host rejection:

```powershell
./.venv/Scripts/python.exe -m unittest neural.test_server
```

Actual local CPU generation was separately exercised with Mithi Charvi/Ahana/Satvik (Bengali), Kokoro Heart/George (US/UK English), Parler Lea with Happy direction, and Parler Jon with Calm narration direction. WAV and MP3 were produced through the authenticated Next.js generation route. These are real model outputs, not mocked provider responses. Parler's first attempt hit a T5/SDPA compatibility error; switching to eager attention produced audio. On the tested Ryzen 7 CPU, the short Lea/Jon jobs took approximately 58/70 seconds, including worker startup and loading. Subjective naturalness/emotion still requires listening; successful synthesis does not prove every profile/style is high quality.

The upgraded Chrome UI was also checked: 72 neural profiles, engine/language search, expressive speaker selection, voice direction and a real British George preview (2.4 seconds). At a 390px mobile viewport, document scroll width matched client width (375px after scrollbar), with no horizontal overflow. The one-command Windows setup script was rerun successfully with all three engines present.

All 72 catalog profiles have upstream IDs; only the specific samples above were generated during this verification. Browser and CI results below describe the original MVP unless explicitly updated. Hosted neural/Vercel deployment has not been tested.

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
