# Project discovery and deployment metadata

The public GitHub repository is the distribution page. The descriptive README, feature table, Bengali installation guide, license, About description and relevant topics help people understand/find it. Optional model weights have separate licenses; cloning weights are not unrestricted commercial open-source assets.

The app includes an accurate Bengali/English AI text-to-speech title/description, Open Graph/Twitter metadata, a generated 1200×630 social card, SVG icon, configurable canonical URL, robots.txt and sitemap.xml. No invented hosted domain, fabricated ratings or ranking guarantee.

## Private/local by default

Without configuration the studio emits noindex/nofollow, robots disallows crawling, and sitemap has no public URLs. These directives are not authentication. Keep production authentication and loopback isolation; see [DEPLOYMENT.md](DEPLOYMENT.md).

## Intentional public deployment

In `.env.local` before building, set your real public HTTPS origin:

```dotenv
PUBLIC_SITE_URL=https://voice.your-real-domain.example
PUBLIC_INDEXING=true
```

Replace the placeholder with your own real origin, rebuild and restart. Private/local addresses and credential-containing URLs are rejected by the metadata helper. API routes remain disallowed. A password-protected studio is not a crawlable public landing page; a separate product landing page can be more appropriate. Do not expose recordings/projects to obtain indexing.

No domain, hosting, GPU rental, search-engine account or paid SEO service is purchased. GitHub SEO does not host the neural service. Public inference still needs a suitable secured computer; ordinary serverless hosting cannot call another PC's localhost.
