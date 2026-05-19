# [feedi](https://feedi.brine.dev)

**Resonance over reach. Sovereignty over scale.**

Feedi is a blog, RSS feed aggregator, feed reader, and podcast host with privacy-friendly analytics — runs on Cloudflare Workers' free tier, forever.

[Demo](https://feedi.brine.dev)

## Requirements
- Node.js
- [Cloudflare](https://cloudflare.com) account (free tier works splendidly)
- A domain/subdomain (optional but recommended)

## Setup

Assumes [git](https://git-scm.com/), [node](https://nodejs.org/) and a [Cloudflare](https://cloudflare.com/) account (free tier).

```bash
git clone https://github.com/qualityshepherd/feedi
cd feedi
npm install
wrangler login
wrangler r2 bucket create your-bucket-name
wrangler d1 create feedi          # prints a database_id — you'll need it next
```

Copy `wrangler.example.toml` to `wrangler.toml`. Fill in:
- `database_id` from the output above
- `bucket_name` for your R2 bucket
- `DOMAIN_NAME` — your domain (used in RSS feed URLs)
- `SITE_TITLE` / `SITE_DESCRIPTION` — used in RSS feeds

Then deploy:

```bash
wrangler d1 migrations apply feedi --remote
wrangler deploy
```

**First-time owner setup:** with no `OWNER` set, go to your site, open the kebab menu (⋮), and click "sign in". It will detect no owner is configured and show a passphrase field — enter one, click "derive pubkey", copy the result, paste it into `wrangler.toml` as `OWNER`, and redeploy. After that, logging in signs a server challenge with your private key; the passphrase never leaves your browser.

Add your custom domain in the Cloudflare dashboard and wait for propagation.

## Writing posts

Click the `+` button on the main page to open the editor. Write in Markdown, preview before publishing, and publish when ready. Drafts are autosaved every 20 seconds.

- Use `#hashtag` in post body to tag posts
- Insert `<break>` to set a "read more" cutoff on the home page

Upload images via the toolbar button or drag-and-drop onto the editor. Images are content-hashed so re-uploading the same file is a no-op.

Download a full backup (posts, feeds, uploads) as a ZIP from the settings panel (cog icon when editor is open).

## RSS feeds

Add external RSS/Atom feeds from the feeds panel. The worker fetches them on a schedule.

Your own feeds are available at:
- `/rss/blog` — posts
- `/rss/pod` — podcast episodes
- `/rss/all` — everything

## Podcast (optional)

Set an audio URL on any post to make it a podcast episode. Supports relative paths (`/uploads/ep1.mp3`) or absolute URLs. The podcast RSS feed is generated automatically at `/rss/pod`.

## Analytics

Privacy-friendly, no third parties. Visible at `/analytics` (owner only). Tracks hits, uniques, top paths, countries, referrers, devices, and RSS subscribers. No cookies; IPs are hashed and never stored.

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
