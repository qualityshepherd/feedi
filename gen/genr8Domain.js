import { promises as fs } from 'fs'
import config from '../feedi.config.js'

const domain = config.domain
const url = `https://${domain}`

// patch index.html bridgy rel=me link
const patchHtml = async () => {
  let html = await fs.readFile('./index.html', 'utf8')
  html = html.replace(
    /<link rel="me" href="[^"]*">/,
    `<link rel="me" href="https://fed.brid.gy/${domain}">`
  )
  await fs.writeFile('./index.html', html, 'utf8')
  console.log(`index.html rel=me → ${domain}`)
}

// patch feeds.json self-blog entry
const patchFeeds = async () => {
  const raw = await fs.readFile('./feeds.json', 'utf8')
  const feeds = JSON.parse(raw)
  const selfUrl = `${url}/assets/rss/blog.xml`
  const selfEntry = { url: selfUrl, limit: 10 }

  // replace existing self-feed entry (blog.xml) or prepend it
  const idx = feeds.findIndex(f => f.url.endsWith('/assets/rss/blog.xml'))
  if (idx >= 0) {
    feeds[idx] = selfEntry
  } else {
    feeds.unshift(selfEntry)
  }

  await fs.writeFile('./feeds.json', JSON.stringify(feeds, null, 2), 'utf8')
  console.log(`feeds.json self-feed → ${selfUrl}`)
}

;(async () => {
  try {
    await Promise.all([patchHtml(), patchFeeds()])
  } catch (err) {
    console.error('genr8Domain failed:', err)
    process.exit(1)
  }
})()
