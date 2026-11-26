# Deployment and GitHub

## Completely local operation

Node.js 22 and this repository are sufficient. `npm ci --legacy-peer-deps`, then `npm run dev`. Open http://127.0.0.1:3000. No service keys or subscriptions.

## Production on an existing computer

Set APP_ACCESS_PASSWORD and a random SESSION_SECRET of at least 32 characters in the server environment or `.env.local`. Run `npm run build` and `npm start`. Secure cookies require HTTPS; terminate TLS using a reverse proxy if accessing a production instance. Start scripts bind loopback intentionally; configure your reverse proxy to that address. Do not expose a passwordless development server.

## GitHub

Create a public repository named `ByteminusVoiceStudio`, leaving automatic README/license/gitignore initialization off when pushing this project. Then:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/ByteminusVoiceStudio.git
git push -u origin main
```

Authenticate through Git Credential Manager or GitHub CLI on your device, never by pasting tokens into chat. Public contributions use forks and pull requests. The included CI workflow runs tests, TypeScript and the build; GitHub service usage remains subject to GitHub's terms. No paid service is required by the app.

## Optional Vercel deployment

The project uses standard Next.js Route Handlers, not a Python process or local model binary. A local production build must pass before deployment. Hosted synthesis on Vercel is not verified by local tests; verify the Emscripten data-file packaging, runtime memory/duration and audio response size on the selected deployment. This project does not promise unlimited free cloud compute.

1. Push this repository to your GitHub account.
2. In Vercel, select Add New Project and import that repository.
3. Keep the Next.js preset and Node.js 22 runtime.
4. Set APP_ACCESS_PASSWORD and SESSION_SECRET in project environment settings. Never use NEXT_PUBLIC for secrets.
5. Deploy. Verify `/api/health`, login, WAV and MP3 generation using a short script.
6. Check runtime logs for engine/data-file errors before sharing the URL.

The 3,000-character limit and bounded queue reduce work per request but do not guarantee every output fits each host's limits. Generate shorter scripts when needed. Multiple serverless instances do not share the in-memory rate limiter or usage counters. Public deployment needs a trusted gateway/distributed limiter, and persistent usage accounting if required. The app currently targets a private single user. Hosting plans and eligibility can change; no paid hosting is selected automatically.

## Domains and monitoring

A custom domain is optional and may cost money; it is unnecessary for local use. For an existing domain, add it in the host's Domains panel and follow its displayed DNS instructions. Monitor server logs and `/api/tts/usage`; the latter describes this server process only, not monthly account usage. Local operation is the no-cloud-billing path.
