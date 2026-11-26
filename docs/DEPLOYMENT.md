# Deployment

## Free local use

```powershell
npm ci --legacy-peer-deps
./scripts/setup-neural.ps1 -Expressive
npm run dev
```

Open http://127.0.0.1:3000 and keep the terminal running. See NEURAL.md. No paid provider keys or subscriptions. Development bypasses password auth only outside production.

## Self-hosted production

Set APP_ACCESS_PASSWORD and a random SESSION_SECRET of at least 32 characters in .env.local or the environment. Never paste credentials into chat or commit them. Install the models/environments on the same machine.

```powershell
npm run build
npm run start:studio
```

Put a trusted HTTPS reverse proxy in front of Next.js on port 3000. Production cookies require HTTPS. Keep Python on 127.0.0.1:8123; never expose that port through the proxy/router. Process counters/limits apply to one instance.

## GitHub

Source: https://github.com/thanvi47/ByteminusVoiceStudio. Commit code, setup scripts, locks, tests and notices. Weights, caches, environments, recordings and credentials are ignored. CI builds/tests the web app without downloading multi-GB models; neural samples are verified locally.

## Vercel and cloud hosting

This version is **not a complete neural Vercel deployment**. A serverless Next.js function cannot reach your laptop's loopback Python service. Vercel can build the web code and use explicitly selected legacy voices, but the default neural workflow needs a separately reachable secured inference service and a corresponding adapter. Neither cloud hosting nor unlimited free compute is configured or promised.

Use the self-hosted workflow for the free-only setup. Custom domains, GPU rental, hardware, electricity and bandwidth may have costs; none is purchased automatically.
