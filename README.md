# [feedi](https://feedi.brine.dev)

**Resonance over reach. Sovereignty over scale.**

Feedi is a blog, RSS reader, and podcast host that runs on Cloudflare Workers' free tier, forever.

[Demo](https://feedi.brine.dev)

## Requirements
- Node.js
- [Cloudflare](https://cloudflare.com) account (free tier works splendidly)
- A domain/subdomain (optional but recommended)

## Setup

```bash
git clone https://github.com/qualityshepherd/feedi
cd feedi
npm install
wrangler login
wrangler kv namespace create FEEDI_KV
wrangler r2 bucket create your-bucket-name
```

Copy `wrangler.example.toml` to `wrangler.toml` and fill in the KV namespace `id` and R2 bucket name, then:

```bash
wrangler deploy
```

Go to `/admin`, enter a passphrase, copy your pubkey, paste it into `wrangler.toml` as `OWNER`, redeploy. Done.

Add your custom domain in the Cloudflare dashboard and wait for propagation.

## Writing posts

Go to `/admin` — create, edit, publish from the browser. Markdown with live preview. Drag, drop, or paste images to upload.

Export your posts anytime as JSON or a zip of `.md` files. You're never locked in.

## RSS feeds

Add external RSS/Atom feeds from `/admin → feeds`. The worker fetches and caches them hourly. Each feed has a configurable post limit.

Your own feeds are available at:
- `/rss/blog` — posts
- `/rss/pod` — podcast episodes
- `/rss/all` — everything

## Podcast (optional)

Set an audio URL on any post to make it a podcast episode. Supports relative paths (`/uploads/ep1.mp3`) or absolute URLs. The podcast RSS feed is generated automatically at `/rss/pod`.

## Analytics

Privacy-friendly, no third parties. Visible in `/admin → analytics`. Tracks hits, uniques, top paths, countries, and RSS subscribers. No cookies, IPs are hashed.

## Local dev

```bash
npx wrangler dev
```

## Tests

```bash
npm test              # unit tests
npm run test:e2e      # e2e (requires running worker: npx wrangler dev)
```

AGPL · brine
