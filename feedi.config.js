const config = {
  // ── edit these ──────────────────────────────────────────────
  title: 'feedi',
  description: 'a public rss reader',
  domain: 'feedi.brine.dev',
  author: 'brine',
  language: 'en-us',
  image: '/assets/images/avatar.svg', // used as podcast cover art fallback
  maxPosts: 10,
  maxFeedItems: 0,       // max items fetched per feed; 0 = no limit
  contentLength: 3000,    // max visible chars per feed; truncates and links to site

  // features
  analytics: true,
  separateFeeds: true, // true = /feeds page + nav link; false = feeds shown at /
  r2Bucket: 'feedi-brine-dev', // must match bucket_name in wrangler.toml

  podcast: {
      author: 'feedi',
      email: 'you@example.com',
      explicit: 'true',
      category: 'Leisure',
      language: 'en-us' // default: en-us
    }
}

export default config
