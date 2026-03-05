const config = {
  // ── edit these ──────────────────────────────────────────────
  title: 'feedi',
  description: 'a public rss reader',
  domain: 'feedi.brine.dev',
  author: 'brine',
  maxPosts: 1,
  maxFeedItems: 20,

  // features
  analytics: true,
  separateFeeds: true, // true = /feeds page + nav link; false = feeds shown at /
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
