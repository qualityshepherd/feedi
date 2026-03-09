[![Deploy](https://github.com/qualityshepherd/feedi/actions/workflows/deploy.yaml/badge.svg?branch=main)](https://github.com/qualityshepherd/feedi/actions/workflows/deploy.yaml)

# [feedi](https://feedi.brine.dev)

[feedi](https://feedi.brine.dev) is a _mostly_ static blog webap that:
 - turns your markdown files into a blog
 - an RSS reader (MANY fediverse apps have an RSS feed; see [/feeds](https://feedi.brine.dev/feeds) for examples)
 - a podcast host
 - beautiful analytics
 - fediverse discoverable via [Bridgy Fed](https://fed.brid.gy), your domain becomes your fedi handle (`@you@yourdomain.com`)

 No algorithm. No platform. No likes. If someone you follow _blogs_ a response, you'll see it. 


## requirements

- Node.js
- [Cloudflare](https://cloudflare.com) account (free tier works)
- A domain (optional but recommended)

## setup

```bash
git clone https://github.com/qualityshepherd/feedi
cd feedi
npm install
```

Edit `feedi.config.js`: set your `domain`, `title`, `author`. Everything flows from there.

### cloudflare

```bash
wrangler login
wrangler kv namespace create KV
```

Copy the KV namespace `id` into `wrangler.toml`, then:

```bash
wrangler secret put API_SECRET   # your analytics password
wrangler deploy
```

Point your domain at Cloudflare. Done.

### r2 backups (optional)

Daily analytics backups. Your data, your bucket, yours forever.

```bash
wrangler r2 bucket create your-bucket-name
```

Set `r2Bucket` in `feedi.config.js` to match your bucket name, then deploy.

## local dev

```bash
npm run server   # builds everything, serves at localhost:4242
```

## writing posts

Markdown files in `posts/`. Filename becomes the slug.

```markdow
title: My Post
date: 2026-01-01
tags: [tag1, tag2

Post content here.
```

Future-dated posts are drafts — won't appear until that date.

## adding feeds

Edit `feeds.json`:

```json
[
  { "url": "https://example.com/feed.xml", "limit": 10 }
]
```

Run `npm start` to rebuild.

## analytics

```
https://yourdomain.com/api/analytics?token=YOUR_SECRET&days=7
```

## podcast (optional)

Uncomment `podcast` in `feedi.config.js`. Tag posts with `podcast` and include an `<audio>` element pointing to your file. Generate the feed:

```bash
npm run rss:pod
```

## fediverse (optional)

```bash
node gen/genr8Domain.js   # patches your domain into index.html
curl -X POST https://fed.brid.gy/web/yourdomain.com
```

Your handle: `@you@yourdomain.com`

## tests

```bash
npm test          # e2e + unit
npm run test:unit
```

MIT · brine
