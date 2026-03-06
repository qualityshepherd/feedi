const config = {
  // edit these
  title: 'feedi',
  description: 'Webring/Blogroll 2.0 that brings back Web 1.0',
  domain: 'feedi.brine.dev',
  author: 'brine',
  language: 'en-us',
  image: '/assets/images/avatar.svg', // used as podcast cover art fallback
  maxPosts: 10,
  maxFeedItems: 42,

  // features
  analytics: true,
  separateFeeds: true, // true = separate feeds and posts; false = everything in /
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
