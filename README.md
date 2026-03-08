[![Deploy](https://github.com/qualityshepherd/feedi/actions/workflows/deploy.yaml/badge.svg?branch=main)](https://github.com/qualityshepherd/feedi/actions/workflows/deploy.yaml)
# [feedi](https://feedi.brine.dev)
Your blog and your RSS reader your podcast host... all on your domain. MACRO blogging: write when you have something to say, read what's worth reading, all in one feed. No algorithm. No platform. No comments.
If someone you follow in your feed writes a response, you'll see it. That's the whole social model.
## what you get
**Blog.** Markdown files, deploy on push. Your posts, your domain, your RSS feed.
**Public RSS reader.** Add any feed to `feeds.json`: blogs, fedi accounts, anything with RSS. Shows up alongside your posts. Your site becomes a public record of what you're paying attention to. No feeds, it's just your blog posts. 
**Unblockable analytics.** Every request hits your Cloudflare Worker on your domain. uBlock, Brave, Safari ITP; none of it matters. Real numbers: hits, unique visitors, countries, referrers, search terms, hourly heatmap. Bot probes counted separately. No js scripts and not those nothingburger platform analytics. Beautiful and usable.  
**Podcast analytics.** feedi tracks feed downloads and which app your listeners use: Overcast, Pocket Casts, Apple Podcasts, Spotify, whatever. The data is _usually_ locked behind hosting platforms. You own it here.
**Fediverse.** Via [Bridgy Fed](https://fed.brid.gy), your domain becomes your fedi handle (`@you@yourdomain.com`). No Mastodon account needed but findable everywhere. 
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
Edit `feedi.config.js` and set your domain, title, author. Everything else flows from there.
### cloudflare
```bash
wrangler login
wrangler kv namespace create KV
```
Copy the KV namespace `id` into `wrangler.toml`. Then:
```bash
wrangler secret put API_SECRET   # your analytics password
wrangler deploy
```
Point your domain at Cloudflare. Done.
### r2 backups (optional)
Daily analytics backups to Cloudflare R2. Public bucket; your data, your bucket, yours forever.
```bash
wrangler r2 bucket create your-bucket-name
```
Set `r2Bucket` in `feedi.config.js` to match. Run `node gen/genr8Domain.js` to regenerate `wrangler.toml`, then `wrangler deploy`.
## local dev
```bash
npm start        # builds index, feeds, rss
npm run server   # serves at localhost:4242
```
## writing posts
Markdown files in `posts/`. Filename = slug.
```markdown
---
title: My Post
date: 2026-01-01
tags: [tag1, tag2]
---
Post content here.
```
Future-dated posts are drafts and won't appear until that date.
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
Uncomment `podcast` in `feedi.config.js`. Tag posts with `podcast` and include an `<audio>` element pointing to your audio file. Generate the feed:
```bash
npm run rss:pod
```
## fediverse (optional)
```bash
node gen/genr8Domain.js   # patches index.html with your domain
curl -X POST https://fed.brid.gy/web/yourdomain.com
```
Your handle: `@you@yourdomain.com`
## tests
```bash
npm test          # e2e + unit
npm run test:unit
```
MIT - brine
