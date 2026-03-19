[![Deploy](https://github.com/qualityshepherd/feedi/actions/workflows/deploy.yaml/badge.svg?branch=main)](https://github.com/qualityshepherd/feedi/actions/workflows/deploy.yaml)
# [feedi](https://feedi.brine.dev)

Feedi is a blog, RSS reader and podcast host, that runs on Cloudflare Workers' free tier, forever.

_Webring/blogroll 2.0 that brings back Web 1.0_

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
```

Edit `feedi.config.js`: set your `domain`, `title`, `author`. Everything flows from there.

```bash
wrangler login
wrangler kv namespace create KV
```

That will spit out a KV namespace `id`. Copy/paste it to `[[kv_namespaces]]` in `wrangler.toml`, then:

```bash
wrangler secret put ADMIN_SECRET   # your analytics password
npm start                          # builds everything
wrangler deploy
```

Add your custom domain on your Cloudflare Worker page and wait for it to propagate. Done.

## Local dev

```bash
npm run server   # builds and serves at localhost:4242
```

## Writing posts

Markdown files go in `posts/`. Filename becomes the slug.

```markdown
---
title: My Post
date: 2026-01-01
tags: tag1, tag2
---

Post content here.
```

Future-dated posts are drafts and won't appear until that date.

## RSS reader

Edit `feeds.json` to add feeds. The worker fetches and caches them hourly. Most anything should work. Limit the number of items to fetch from each feed. Set the maxFeedItems (number of feeds) and contentLength (truncate feed length) in `feedi.config.js`.

```json
[
  { "url": "https://example.com/feed.xml", "limit": 4 }
]
```

## Analytics

Privacy-friendly, no third parties. View at:

```
https://yourdomain.com/api/analytics?secret=YOUR_SECRET
```

![feedi analytics dashboard](/assets/images/analytics.png)

### R2 backups (optional)

Daily analytics backups to your own bucket:

```bash
wrangler r2 bucket create your-bucket-name
```

Set `r2Bucket` in `feedi.config.js` to match, then deploy.

## Podcast (optional)

Put episode posts in `pods/` instead of `posts/`. Same frontmatter, just add an `<audio>` element pointing to your file. The podcast RSS feed is generated automatically on build and validated by a unit test. 

## Fediverse (optional)

feedi uses [Bridgy Fed](https://fed.brid.gy) to bridge your RSS feed into the Fediverse. No ActivityPub server, no HTTP signatures. The `rel=me` link is stamped into `index.html` at build time from your config.

Register once at [fed.brid.gy](https://fed.brid.gy); enter your domain and follow the prompts.

Your handle: `@yourdomain.com@yourdomain.com`. New posts appear in followers' timelines automatically.

## Tests

```bash
npm test
```

------

AGPL · brine
