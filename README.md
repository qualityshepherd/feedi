# [feedi](https://feedi.brine.dev)

**Resonance over reach. Sovereignty over scale.**

Feedi is a blog, RSS reader, podcast host, and peer discovery network that runs on Cloudflare Workers' free tier, forever.

Each feedi instance is a node. Nodes publish `peers.json` — a list of other known feedi domains. The cron job fetches posts from all peers and caches the result. No handshake, no algorithm, no follower counts. Just public JSON and HTTP GETs. The mesh emerges from people linking to people they find interesting.

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
```

Paste the KV namespace `id` into `wrangler.toml`, then:

```bash
wrangler deploy
```

Go to `/admin`, enter a passphrase, copy your pubkey, paste it into `wrangler.toml` as `OWNER`, redeploy. Done.

Add your custom domain in the Cloudflare dashboard and wait for propagation.

## Writing posts

Go to `/admin` — create, edit, publish from the browser. Markdown with live preview.

Export your posts anytime as JSON or a zip of `.md` files. You're never locked in.

## RSS reader

Edit `feeds.json` to follow external RSS/Atom feeds. The worker fetches and caches them hourly.

```json
[
  { "url": "https://example.com/feed.xml", "limit": 4 }
]
```

## Peers

Add feedi instances you want to follow at `/admin`. Their posts appear in `/peers/feed`, aggregated and sorted by date. When you add a peer, their peers are surfaced as suggestions — the network meshes out organically.

```json
// peers.json — auto-generated, public
[
  { "url": "https://feedi.brine.dev", "title": "brine's feedi" }
]
```

## Analytics

Privacy-friendly, no third parties. View at `/api/analytics?secret=YOUR_SECRET`.

### R2 backups (optional)

Daily analytics backups to R2:

```bash
wrangler r2 bucket create your-bucket-name
```

Set `r2Bucket` in `feedi.config.js` to match, then deploy.

## Podcast (optional)

Put episode posts in `pods/` instead of `posts/`. Same frontmatter, add an `<audio>` element. Podcast RSS feed is generated automatically.

## Local dev

```bash
npx wrangler dev
```

## Tests

```bash
npm test          # full suite (e2e + unit)
npm run test:unit # unit only
```

AGPL · brine
