import { memberByToken, isOwnerPubkey } from './auth.js'

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })

const PRIVATE_IP = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

export const isValidDiscoverUrl = (url) => {
  if (!url) return false
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    if (PRIVATE_IP.test(parsed.hostname)) return false
    return parsed.origin
  } catch { return false }
}

export const normalizeTag = tag =>
  String(tag).toLowerCase().replace(/^#/, '').trim()

export const dedupInstances = (instances) => {
  const seen = new Set()
  return instances.filter(i => {
    if (seen.has(i.url)) return false
    seen.add(i.url)
    return true
  })
}

export const extractTags = (posts) => {
  const counts = {}
  for (const post of posts) {
    for (const tag of (post.meta?.tags || [])) {
      const t = normalizeTag(tag)
      if (t) counts[t] = (counts[t] || 0) + 1
    }
  }
  return Object.entries(counts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

export const aggregatePosts = (results, { maxPerInstance = 50 } = {}) =>
  results
    .filter(Boolean)
    .flatMap(({ instanceUrl, posts }) =>
      posts.slice(0, maxPerInstance).map(post => ({
        ...post,
        meta: { ...post.meta, instanceUrl }
      }))
    )
    .sort((a, b) => new Date(b.meta.date) - new Date(a.meta.date))

// ── fetch helpers ─────────────────────────────────────────────────────────────

const fetchInstance = async (url) => {
  try {
    const res = await fetch(`${url}/index.json`, {
      headers: { 'User-Agent': 'feedi-discover/1.0' },
      cf: { cacheTtl: 300 }
    })
    if (!res.ok) return { url, status: res.status, lastSeen: null, posts: [] }
    if (res.headers.get('X-Feedi-Private') === 'true') return null // opted out

    const data = await res.json()
    // Support opt-out via JSON field on wrapped format
    if (data && !Array.isArray(data) && data.discoverable === false) return null
    const posts = Array.isArray(data) ? data : []

    const tags = [...new Set(
      posts.flatMap(p => (p.meta?.tags || []).map(normalizeTag)).filter(Boolean)
    )].slice(0, 30)

    return {
      url,
      status: 200,
      lastSeen: new Date().toISOString(),
      tags,
      postCount: posts.length,
      posts
    }
  } catch {
    return { url, status: 0, lastSeen: null, posts: [] }
  }
}

// Fetch /discover.json from a known instance to find new instances (1-hop crawl)
const fetchInstancePeers = async (url) => {
  try {
    const res = await fetch(`${url}/discover.json`, {
      headers: { 'User-Agent': 'feedi-discover/1.0' },
      cf: { cacheTtl: 3600 }
    })
    if (!res.ok) return []
    const list = await res.json()
    if (!Array.isArray(list)) return []
    return list.filter(p => p?.url).map(p => ({ url: p.url, title: p.title || '' }))
  } catch { return [] }
}

// Announce our existence to a peer
const announceToInstance = async (theirUrl, ourUrl) => {
  try {
    await fetch(`${theirUrl}/discover/announce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'feedi-discover/1.0' },
      body: JSON.stringify({ url: ourUrl }),
      cf: { cacheTtl: 0 }
    })
  } catch { /* fire and forget */ }
}

// ── cron ──────────────────────────────────────────────────────────────────────

export const refreshDiscover = async (env) => {
  const kv = env.FEEDI_KV
  const [known, blocked] = await Promise.all([
    kv.get('discover:known', { type: 'json' }).then(r => r || []),
    kv.get('discover:blocked', { type: 'json' }).then(r => r || [])
  ])

  const blockedSet = new Set(blocked)
  const active = known.filter(i => !blockedSet.has(i.url))
  if (!active.length) return

  // Fetch all active instances
  const results = await Promise.allSettled(active.map(i => fetchInstance(i.url)))
  const fetched = results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { ...active[i], status: 0, posts: [] }
  ).filter(Boolean) // null = opted out, remove from known

  // 1-hop crawl: fetch /discover.json from each instance to find new instances
  const peerLists = await Promise.allSettled(
    fetched.filter(f => f.status === 200).map(f => fetchInstancePeers(f.url))
  )

  const knownUrls = new Set(known.map(i => i.url))
  const newInstances = []
  peerLists.forEach(r => {
    if (r.status !== 'fulfilled') return
    for (const peer of r.value) {
      const normalized = isValidDiscoverUrl(peer.url)
      if (normalized && !knownUrls.has(normalized) && !blockedSet.has(normalized)) {
        knownUrls.add(normalized)
        newInstances.push({ url: normalized, title: peer.title || normalized })
      }
    }
  })

  // Update known list: fetched metadata + opted-out removed + new discovered
  const updatedKnown = dedupInstances([
    ...fetched.map(({ posts: _p, ...meta }) => meta), // strip posts from metadata
    ...newInstances
  ])

  // Build aggregated post cache
  const allPosts = aggregatePosts(
    fetched.filter(f => f.status === 200).map(f => ({ instanceUrl: f.url, posts: f.posts }))
  ).slice(0, 500)

  const tags = extractTags(allPosts)

  await Promise.all([
    kv.put('discover:known', JSON.stringify(updatedKnown)),
    kv.put('discover:cache', JSON.stringify(allPosts)),
    kv.put('discover:tags', JSON.stringify(tags))
  ])

  console.log(`[discover] ${allPosts.length} posts from ${fetched.filter(f => f.status === 200).length}/${active.length} instances, ${newInstances.length} new discovered`)
}

// ── routes ────────────────────────────────────────────────────────────────────

export const handleDiscover = async (req, env, ctx) => {
  const url = new URL(req.url)
  const path = url.pathname
  const method = req.method
  const kv = env.FEEDI_KV

  // ── public routes ──────────────────────────────────────────────────────────

  // List of known non-blocked instances (for graph crawling by other feedis)
  if (method === 'GET' && path === '/discover.json') {
    const [known, blocked] = await Promise.all([
      kv.get('discover:known', { type: 'json' }).then(r => r || []),
      kv.get('discover:blocked', { type: 'json' }).then(r => r || [])
    ])
    const blockedSet = new Set(blocked)
    const public_ = known
      .filter(i => !blockedSet.has(i.url))
      .map(({ url: u, title }) => ({ url: u, title }))
    return new Response(JSON.stringify(public_), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }
    })
  }

  // Aggregated posts feed
  if (method === 'GET' && path === '/discover/feed') {
    const tag = url.searchParams.get('tag')
    const q = url.searchParams.get('q')
    let posts = await kv.get('discover:cache', { type: 'json' }) || []
    if (tag) posts = posts.filter(p => (p.meta.tags || []).map(normalizeTag).includes(normalizeTag(tag)))
    if (q) posts = posts.filter(p => p.meta.title?.toLowerCase().includes(q.toLowerCase()))
    return new Response(JSON.stringify(posts), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
    })
  }

  // Tag list
  if (method === 'GET' && path === '/discover/tags') {
    const tags = await kv.get('discover:tags', { type: 'json' }) || []
    return new Response(JSON.stringify(tags), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }
    })
  }

  // Announce: another feedi telling us they exist
  if (method === 'POST' && path === '/discover/announce') {
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

    const normalized = isValidDiscoverUrl(body.url)
    if (!normalized) return json({ error: 'invalid url' }, 400)

    const blocked = await kv.get('discover:blocked', { type: 'json' }) || []
    if (blocked.includes(normalized)) return json({ ok: true }) // silently ignore

    // Rate limit: one announce per domain per 24h
    const rateKey = `discover:announce:${new URL(normalized).hostname}`
    const seen = await kv.get(rateKey)
    if (seen) return json({ ok: true }) // already processed recently

    // Validate it's a real feedi
    const result = await fetchInstance(normalized)
    if (!result || result.status !== 200) return json({ error: 'could not reach instance' }, 422)

    // Add to known if not already there
    const known = await kv.get('discover:known', { type: 'json' }) || []
    if (!known.some(i => i.url === normalized)) {
      const updated = dedupInstances([...known, { url: normalized, title: normalized }])
      await kv.put('discover:known', JSON.stringify(updated))
    }

    // Rate limit TTL: 24h
    await kv.put(rateKey, '1', { expirationTtl: 86400 })
    return json({ ok: true })
  }

  // ── authed routes ──────────────────────────────────────────────────────────

  const token = req.headers?.get('authorization')?.replace('Bearer ', '')
  const pubkey = await memberByToken(token, kv)
  if (!pubkey || !isOwnerPubkey(pubkey, env)) return json({ error: 'unauthorized' }, 401)

  // GET /api/discover — list known instances with metadata
  if (method === 'GET' && path === '/api/discover') {
    const [known, blocked] = await Promise.all([
      kv.get('discover:known', { type: 'json' }).then(r => r || []),
      kv.get('discover:blocked', { type: 'json' }).then(r => r || [])
    ])
    const blockedSet = new Set(blocked)
    return json(known.map(i => ({ ...i, blocked: blockedSet.has(i.url) })))
  }

  // POST /api/discover — seed a new instance
  if (method === 'POST' && path === '/api/discover') {
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

    const normalized = isValidDiscoverUrl(body.url)
    if (!normalized) return json({ error: 'invalid url — must be https, no localhost' }, 400)

    const result = await fetchInstance(normalized)
    if (!result || result.status !== 200) return json({ error: 'could not reach instance index.json' }, 422)

    const known = await kv.get('discover:known', { type: 'json' }) || []
    if (known.some(i => i.url === normalized)) return json({ error: 'already known' }, 409)

    const { posts: _p, ...meta } = result
    const updated = dedupInstances([...known, meta])
    await kv.put('discover:known', JSON.stringify(updated))

    // Announce ourselves to them if we have a base URL
    if (env.OWNER_URL) ctx.waitUntil(announceToInstance(normalized, env.OWNER_URL))
    ctx.waitUntil(refreshDiscover(env))

    return json({ ok: true, url: normalized })
  }

  // GET /api/discover/blocked — list blocked instances
  if (method === 'GET' && path === '/api/discover/blocked') {
    const blocked = await kv.get('discover:blocked', { type: 'json' }) || []
    return json(blocked)
  }

  // POST /api/discover/block — block an instance
  if (method === 'POST' && path === '/api/discover/block') {
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

    const normalized = isValidDiscoverUrl(body.url)
    if (!normalized) return json({ error: 'invalid url' }, 400)

    const [known, blocked] = await Promise.all([
      kv.get('discover:known', { type: 'json' }).then(r => r || []),
      kv.get('discover:blocked', { type: 'json' }).then(r => r || [])
    ])
    if (!blocked.includes(normalized)) {
      await kv.put('discover:blocked', JSON.stringify([...blocked, normalized]))
    }
    // Remove from known
    const updatedKnown = known.filter(i => i.url !== normalized)
    await kv.put('discover:known', JSON.stringify(updatedKnown))

    return json({ ok: true })
  }

  // DELETE /api/discover/block — unblock an instance
  if (method === 'DELETE' && path === '/api/discover/block') {
    let body
    try { body = await req.json() } catch { return json({ error: 'invalid json' }, 400) }

    const normalized = isValidDiscoverUrl(body.url)
    if (!normalized) return json({ error: 'invalid url' }, 400)

    const blocked = await kv.get('discover:blocked', { type: 'json' }) || []
    await kv.put('discover:blocked', JSON.stringify(blocked.filter(u => u !== normalized)))

    return json({ ok: true })
  }

  return json({ error: 'not found' }, 404)
}
