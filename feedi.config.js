const config = {
  // ── edit these ──────────────────────────────────────────────
  title: 'feedi',
  description: 'a public rss reader',
  domain: 'feedi.brine.dev',
  author: 'brine',
  image: '/assets/images/avatar.svg', // used as podcast cover art fallback
  maxPosts: 10,
  maxFeedItems: 20,

  // features
  analytics: true,
  separateFeeds: true, // true = /feeds page + nav link; false = feeds shown at /
  r2Bucket: 'feedi-brine-dev', // must match bucket_name in wrangler.toml

  podcast: {
    author: 'your name',
    email: 'you@example.com',
    explicit: 'false',
    category: 'Leisure',
    language: 'en-us',
  }
}

export default config
