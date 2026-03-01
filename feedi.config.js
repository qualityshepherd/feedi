const config = {
  // ── edit these ──────────────────────────────────────────────
  title: 'feedi',
  description: 'a public rss reader',
  domain: 'feedi.brine.dev',
  author: 'brine',
  maxPosts: 10,

  // features
  analytics: true,
  r2Bucket: 'feedi-brine-dev' // must match bucket_name in wrangler.toml

  // ── podcast (optional) ──────────────────────────────────────
  // uncomment and fill in if you have a podcast
  // podcast: {
  //   author: 'your name',
  //   email: 'you@example.com',
  //   explicit: 'false',
  //   category: 'Leisure'
  // }
}

export default config
