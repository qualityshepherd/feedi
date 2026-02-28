[![Deploy](https://github.com/qualityshepherd/feedi/actions/workflows/deploy.yaml/badge.svg?branch=main)](https://github.com/qualityshepherd/feedi/actions/workflows/deploy.yaml)

# feedi

feedi is a _public_ RSS reader that includes your blog. Add any RSS feed to `feeds.json` (including your own) and it shows up on your site. Your writing, what you're reading, all on your domain. No algorithm. No platform. No comments. If someone writes a response and you follow their feed, you'll see it. That's the whole social model.

It's MACRO blogging. Write when you have something to say. Read what's worth reading. YOU own all of it forever.

## what you get

**A blog.** Write in markdown, deploy on push. Your posts, your domain, your RSS feed.

**A public RSS reader.** Add any feed to `feeds.json` — other blogs, fedi accounts, anything with RSS. It shows up alongside your posts. Your site becomes a public record of what you're paying attention to.

**Unblockable analytics.** Every request hits your Cloudflare Worker on your domain. uBlock, Brave, Safari ITP — none of it matters. You see real numbers: hits, unique visitors, countries, referrers, search terms. Bot probes counted separately so they don't pollute your data.

**Podcast metrics that usually cost money.** If you host a podcast, feedi tracks feed downloads AND which app your listeners use — Overcast, Pocket Casts, Apple Podcasts, Spotify. That data is normally locked behind hosting platforms. You own it here.

**Fediverse presence.** Via [Bridgy Fed](https://fed.brid.gy), your domain becomes your fedi handle (`@you@yourdomain.com`). No Mastodon account needed. Write a post, it reaches the fediverse. Someone replies via their blog, you see it if you follow their feed.

---

## requirements

- Node.js
- A [Cloudflare](https://cloudflare.com) account (free tier works)
- A domain (optional but recommended)

## setup

```bash
git clone https://github.com/qualityshepherd/feedi
cd feedi
npm install
```

Edit `feedi.config.js`:

```js
const config = {
  title: 'your site name',
  description: 'your description',
  domain: 'yourdomain.com',
  author: 'yourname',
  ...
}
```

## run locally

```bash
npm start        # builds index, feeds, rss
npm run server   # serves at localhost:4242
```

## deploy to cloudflare

```bash
wrangler login
wrangler deploy
```

Set your analytics token:

```bash
wrangler secret put API_SECRET
```

Point your domain at Cloudflare. Done.

## analytics

View your dashboard at:

```
https://yourdomain.com/api/analytics?token=YOUR_SECRET&days=7
```

Switch between today / 7d / 30d / 90d. Shows hits, unique visitors, top pages, countries, referrers, search terms, hourly heatmap, and bot probe count. If you run a podcast, it shows feed downloads and which apps your listeners use.

## fediverse

Add to `index.html`:

```html
<link rel="me" href="https://fed.brid.gy/yourdomain.com">
```

Register with Bridgy:

```bash
curl -X POST https://fed.brid.gy/web/yourdomain.com
```

Your handle: `@you@yourdomain.com`

## writing posts

Markdown files in `posts/`. Filename = slug. Front matter:

```markdown
---
title: My Post
date: 2026-01-01
tags: [tag1, tag2]
---

Post content here.
```

Future-dated posts are drafts — won't appear until that date.

## adding feeds

Edit `feeds.json`:

```json
[
  { "url": "https://example.com/feed.xml", "limit": 10 },
  { "url": "https://yourdomain.com/assets/rss/blog.xml", "limit": 5 }
]
```

Run `npm start` to rebuild.

## podcast (optional)

Uncomment `podcast` in `feedi.config.js` and fill in your details. Tag posts with `podcast` and include an `<audio>` element. Generate the feed:

```bash
node ./gen/genr8Pod.js
```

feedi will automatically track feed downloads and podcast app breakdown in your analytics dashboard.

MIT - brine
