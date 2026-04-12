import { getAllPosts } from './posts.js'

const escXml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const rfc822 = (dateStr) => {
  const d = dateStr ? new Date(dateStr) : new Date()
  return isNaN(d) ? new Date().toUTCString() : d.toUTCString()
}

const channelOpen = (cfg, selfUrl) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>${escXml(cfg.title)}</title>
  <link>https://${escXml(cfg.domain)}</link>
  <description>${escXml(cfg.description)}</description>
  <language>${escXml(cfg.language || 'en-us')}</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="https://${escXml(cfg.domain)}${selfUrl}" rel="self" type="application/rss+xml"/>`

const podChannelOpen = (cfg, selfUrl) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
<channel>
  <title>${escXml(cfg.title)}</title>
  <link>https://${escXml(cfg.domain)}</link>
  <description>${escXml(cfg.description)}</description>
  <language>${escXml(cfg.language || 'en-us')}</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  <atom:link href="https://${escXml(cfg.domain)}${selfUrl}" rel="self" type="application/rss+xml"/>
  <itunes:author>${escXml(cfg.title)}</itunes:author>
  <itunes:summary>${escXml(cfg.description)}</itunes:summary>
  <itunes:explicit>false</itunes:explicit>${cfg.image ? `\n  <itunes:image href="${escXml(cfg.image)}"/>` : ''}`

const channelClose = () => '\n</channel>\n</rss>'

const postItem = (post, baseUrl) => {
  const url = `${baseUrl}/posts/${post.slug}`
  const safeHtml = (post.html || '')
    .replace(/src="(?!https?:\/\/)/g, `src="${baseUrl}/`)
    .replace(/]]>/g, ']]&gt;')
  const summary = post.description || safeHtml.replace(/<[^>]+>/g, '').slice(0, 280)
  return `
  <item>
    <title>${escXml(post.title)}</title>
    <link>${url}</link>
    <guid isPermaLink="true">${url}</guid>
    <pubDate>${rfc822(post.date)}</pubDate>
    <description>${escXml(summary)}</description>
    <content:encoded><![CDATA[${safeHtml}]]></content:encoded>
  </item>`
}

const podItem = (post, baseUrl) => {
  const url = `${baseUrl}/posts/${post.slug}`
  const safeHtml = (post.html || '')
    .replace(/src="(?!https?:\/\/)/g, `src="${baseUrl}/`)
    .replace(/]]>/g, ']]&gt;')
  const audio = post.audioUrl || ''
  const audioUrl = audio.startsWith('http') ? audio : `${baseUrl}${audio.startsWith('/') ? audio : `/${audio}`}`
  const summary = post.description || safeHtml.replace(/<[^>]+>/g, '').slice(0, 280)
  return `
  <item>
    <title>${escXml(post.title)}</title>
    <link>${url}</link>
    <guid isPermaLink="true">${url}</guid>
    <pubDate>${rfc822(post.date)}</pubDate>
    <description>${escXml(summary)}</description>
    <content:encoded><![CDATA[${safeHtml}]]></content:encoded>
    <enclosure url="${escXml(audioUrl)}" length="0" type="audio/mpeg"/>
    <itunes:title>${escXml(post.title)}</itunes:title>
    <itunes:summary>${escXml(summary)}</itunes:summary>
    <itunes:explicit>false</itunes:explicit>
  </item>`
}

export const handleRss = async (req, env) => {
  const path = new URL(req.url).pathname
  const kv = env.FEEDI_KV
  const cfg = {
    title: env.SITE_TITLE || 'feedi',
    description: env.SITE_DESCRIPTION || '',
    domain: env.DOMAIN_NAME || '',
    language: 'en-us',
    image: env.PODCAST_IMAGE || ''
  }
  const base = `https://${cfg.domain}`

  const allPosts = (await getAllPosts(kv))
    .filter(p => p.status === 'published' && p.type !== 'page')
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  if (path === '/rss/blog') {
    const posts = allPosts.filter(p => !p.audioUrl)
    const xml = channelOpen(cfg, '/rss/blog') +
      posts.map(p => postItem(p, base)).join('') +
      channelClose()
    return rssResponse(xml)
  }

  if (path === '/rss/pod') {
    const posts = allPosts.filter(p => p.audioUrl)
    const xml = podChannelOpen(cfg, '/rss/pod') +
      posts.map(p => podItem(p, base)).join('') +
      channelClose()
    return rssResponse(xml)
  }

  if (path === '/rss/all') {
    const xml = channelOpen(cfg, '/rss/all') +
      allPosts.map(p => postItem(p, base)).join('') +
      channelClose()
    return rssResponse(xml)
  }

  return null
}

const rssResponse = (xml) =>
  new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  })
