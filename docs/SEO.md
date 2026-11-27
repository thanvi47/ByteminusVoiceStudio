# Project discovery and deployment metadata

The public GitHub repository is the source distribution page. The free documentation website is https://thanvi47.github.io/ByteminusVoiceStudio/. It has a descriptive title, canonical URL, Open Graph metadata, visible bilingual explanations, installation links, factual SoftwareApplication JSON-LD, a sitemap and a plain-text documentation index. It hosts no inference server or private recordings. Optional model weights have separate licenses; cloning weights are not unrestricted commercial open-source assets.

## Search and AI discovery

README wording, repository description/topics, public documentation and useful links can improve discovery; they cannot force indexing, ranking or recommendations from Google, ChatGPT, Claude or Gemini. Search retrieval is different from training a model: publishing a page does not update every AI model's stored knowledge. `llms.txt` is a convenience index, not a universal crawler protocol, special registration or ranking guarantee. Google says its AI search features use ordinary SEO practices and do not require special AI files: [official guidance](https://developers.google.com/search/docs/appearance/ai-features).

The site is plain static HTML so readers and crawlers do not need client-side JavaScript to see its content. Structured data describes visible facts; no invented reviews, ratings or user counts are included. GitHub controls github.com headers/robots and the github.io host infrastructure; project-level files cannot override GitHub's crawler access rules. In particular, `/ByteminusVoiceStudio/robots.txt` would not control the origin's `/robots.txt`, so no misleading project-level robots file is provided. The public documentation's `index,follow` meta tag is separate from the private studio's defaults.

## Free indexing and measurement steps for the owner

1. In [Google Search Console](https://search.google.com/search-console), add the **URL-prefix** property `https://thanvi47.github.io/ByteminusVoiceStudio/`. A domain property would require DNS control of github.io, which this repository does not provide.
2. Use Google's HTML verification file or meta-tag method and add the provided value under `docs/` or in `docs/index.html`; commit/push, wait for Pages deployment, then verify. No Search Console verification has been claimed unless actually completed.
3. Submit `https://thanvi47.github.io/ByteminusVoiceStudio/sitemap.xml` in Sitemaps. Inspect the homepage URL and use Request indexing if Google makes it available. A request is not guaranteed indexing.
4. Add the same owned site to [Bing Webmaster Tools](https://www.bing.com/webmasters/) and follow its verification flow. Search discovery can help search-enabled assistants find sources, but does not guarantee citations.
5. Check indexing, impressions and query clicks in the verified consoles over time. Broad phrases such as “Bengali & English AI Text to Speech” are competitive. Brand queries and specific use cases such as local Bangla TTS with SRT are useful discovery targets, without keyword stuffing.

Share the project in relevant communities with accurate examples when appropriate. This task does not authorize unsolicited messages, purchased backlinks, fake stars or mass submissions. No such promotion is automated. Fresh pages may take time to be crawled; no fixed ranking deadline is promised.

## GitHub Pages publication

Repository Settings → Pages → Deploy from a branch → `main` → `/docs` → Save. The `.nojekyll` file serves the curated static files directly. Website links point to GitHub for detailed Markdown guides. Only public documentation and a fixed generic sample are copied to `docs/assets/`; `.models`, `.data`, runtime files and credentials are not published. Adding or changing HTML under `docs/` deploys through GitHub Pages after pushing main.

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
