import config from '../feedi.config.js'

const SKIP_PATHS = [
  '/.well-known',
  '/actor',
  '/api',
  '/favicon',
  '/robots.txt',
  '/index.json',
  '/feedIndex.json',
  '/feeds.json',
  '/sitemap'
]

const SKIP_EXTENSIONS = ['.png', '.jpg', '.svg', '.ico', '.woff', '.woff2', '.otf', '.ttf', '.css', '.js']

const BOT_PATHS = ['.php', '.asp', '.aspx', '.env', '.git', 'wp-', 'xmlrpc', 'shell', 'setup', 'config', 'admin', 'backup', '.sql', 'passwd', 'cgi-bin', 'statistics.json', 'swagger', 'actuator', 'graphql', 'telescope']

const RSS_PATHS = ['/assets/rss/blog.xml', '/assets/rss/pod.xml']

// ── pure functions (exported for testing) ────────────────────

const BOT_UAS = ['python', 'curl', 'wget', 'go-http', 'libwww', 'node-fetch', 'axios', 'urllib']

export const isBot = (path, ua = '') =>
  BOT_PATHS.some(p => path.toLowerCase().includes(p)) ||
  SKIP_EXTENSIONS.some(e => path.toLowerCase().split('?')[0].endsWith(e)) ||
  BOT_UAS.some(b => ua.toLowerCase().includes(b))

export const detectPodApp = (ua) => {
  if (ua.includes('Overcast')) return 'Overcast'
  if (ua.includes('PocketCasts')) return 'Pocket Casts'
  if (ua.includes('Spotify')) return 'Spotify'
  if (ua.includes('AppleCoreMedia')) return 'Apple Podcasts'
  if (ua.includes('Castro')) return 'Castro'
  if (ua.includes('Downcast')) return 'Downcast'
  return 'Other'
}

export const countryFlag = (code) => {
  if (!code || code === '?') return ''
  const flag = code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  )
  return `<span title="${code}">${flag}</span> `
}

export const buildHeatmap = (allHits) => {
  const hours = Array(24).fill(0)
  // placeholder cells — filled client-side in local timezone
  return hours.map((_, hour) => {
    const label = hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`
    return `<div class="heatmap-cell" data-hour="${hour}" style="opacity:0.05" title="${label}"></div>`
  }).join('')
}

// ── worker functions ──────────────────────────────────────────

export async function trackHit (req, env) {
  if (!config.analytics) return

  const url = new URL(req.url)
  const path = url.pathname + (url.search || '')
  const today = new Date().toISOString().slice(0, 10)
  const ip = req.headers.get('cf-connecting-ip') || ''

  // track RSS hits
  if (RSS_PATHS.includes(url.pathname)) {
    const key = 'rss:' + url.pathname + ':' + today
    const ua = req.headers.get('user-agent') || ''
    const existing = await env.KV.get(key, 'json') || { hits: [] }
    existing.hits.push({ ts: Date.now(), ua })
    await env.KV.put(key, JSON.stringify(existing))
    return
  }

  // skip non-content paths
  if (SKIP_PATHS.some(p => path.startsWith(p))) return

  const ua = req.headers.get('user-agent') || ''

  // count bot probes -- throttle via Cache API (free, no KV writes)
  if (isBot(path, ua)) {
    const ipHash = await hashIp(ip)
    const cacheKey = new Request('https://bot-throttle.local/' + ipHash)
    const cache = caches.default
    const throttled = await cache.match(cacheKey)
    if (throttled) return
    await cache.put(cacheKey, new Response('1', { headers: { 'Cache-Control': 'max-age=600' } }))
    const count = parseInt(await env.KV.get('bots:' + today) || '0') + 1
    await env.KV.put('bots:' + today, String(count))
    return
  }

  const cf = req.cf || {}
  const ipHash = await hashIp(ip)
  const hit = {
    path,
    ts: Date.now(),
    country: cf.country || '?',
    city: cf.city || '?',
    region: cf.region || '?',
    referrer: req.headers.get('referer') || '',
    ua: req.headers.get('user-agent') || '',
    ip: ipHash
  }

  try {
    const key = 'hits:' + today
    const existing = await env.KV.get(key, 'json') || { hits: [] }
    existing.hits.push(hit)
    await env.KV.put(key, JSON.stringify(existing))
  } catch (err) {
    console.error('Analytics write failed:', err)
  }
}


// cron: runs daily at 2am via wrangler.toml [triggers]
export const backupKey = (date) => `feedi-backups/analytics-${date}.json`

export async function backupToR2 (env) {
  if (!env.R2) return

  const today = new Date().toISOString().slice(0, 10)
  const backup = {}

  // hits
  const hits = await env.KV.get(`hits:${today}`, 'json')
  if (hits) backup.hits = hits

  // bots
  const bots = await env.KV.get(`bots:${today}`)
  if (bots) backup.bots = parseInt(bots)

  // rss
  const rssKeys = await env.KV.list({ prefix: `rss:` })
  backup.rss = {}
  for (const { name } of rssKeys.keys) {
    if (name.endsWith(today)) {
      const data = await env.KV.get(name, 'json')
      if (data) backup.rss[name] = data
    }
  }

  await env.R2.put(backupKey(today), JSON.stringify(backup), {
    httpMetadata: { contentType: 'application/json' }
  })

  console.log(`backed up analytics for ${today} to R2`)
}

async function hashIp (ip) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function handleAnalytics (req, env) {
  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') || '7')
  const token = url.searchParams.get('token')

  if (!token || token !== env.API_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const result = []
  let totalBots = 0
  const rssData = {}

  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const data = await env.KV.get(`hits:${dateStr}`, 'json')
    const bots = parseInt(await env.KV.get(`bots:${dateStr}`) || '0')
    totalBots += bots
    if (data) result.push({ date: dateStr, hits: data.hits })

    for (const rsspath of RSS_PATHS) {
      const rssKey = `rss:${rsspath}:${dateStr}`
      const rss = await env.KV.get(rssKey, 'json')
      if (rss) {
        if (!rssData[rsspath]) rssData[rsspath] = []
        rssData[rsspath].push(...rss.hits)
      }
    }
  }

  const accept = req.headers.get('accept') || ''
  if (accept.includes('text/html')) {
    return new Response(buildDashboard(result, days, token, totalBots, rssData), {
      headers: { 'Content-Type': 'text/html' }
    })
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  })
}

function buildDashboard (data, days, token, totalBots, rssData) {
  const tokenParam = token ? `&token=${token}` : ''
  const allHits = data.flatMap(d => d.hits)
  const totalHits = allHits.length

  const byPath = {}
  for (const h of allHits) {
    byPath[h.path] = (byPath[h.path] || 0) + 1
  }
  const topPaths = Object.entries(byPath).sort((a, b) => b[1] - a[1]).slice(0, 20)

  const byCountry = {}
  for (const h of allHits) {
    byCountry[h.country] = (byCountry[h.country] || 0) + 1
  }
  const topCountries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const byRef = {}
  for (const h of allHits) {
    if (h.referrer) {
      try {
        const ref = new URL(h.referrer).hostname
        byRef[ref] = (byRef[ref] || 0) + 1
      } catch {}
    }
  }
  const topRefs = Object.entries(byRef).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const uniqueIps = new Set(allHits.map(h => h.ip)).size
  const blogRss = (rssData['/assets/rss/blog.xml'] || []).length
  const podRss = (rssData['/assets/rss/pod.xml'] || []).length

  const podApps = {}
  for (const h of (rssData['/assets/rss/pod.xml'] || [])) {
    const app = detectPodApp(h.ua)
    podApps[app] = (podApps[app] || 0) + 1
  }
  const topPodApps = Object.entries(podApps).sort((a, b) => b[1] - a[1])

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>feedi analytics</title>
  <style>
    @font-face { font-family: 'header'; font-weight: 600; src: url('/assets/fonts/Oswald-Regular.ttf') format('truetype'); }
    @font-face { font-family: 'Inter'; font-style: normal; font-weight: 420; src: url('/assets/fonts/Inter-Regular.woff2') format('woff2'); }
    @font-face { font-family: 'Inter'; font-style: italic; font-weight: 420; src: url('/assets/fonts/Inter-Italic.woff2') format('woff2'); }
    @font-face { font-family: 'Inter'; font-style: normal; font-weight: 700; src: url('/assets/fonts/Inter-Bold.woff2') format('woff2'); }
    @font-face { font-family: 'mono'; font-weight: 420; src: url('/assets/fonts/intelone-mono-font-family-regular.otf') format('opentype'); }
    :root {
      --bg: #363636; --bg-darker: #333333; --bg-darkest: #222222;
      --text: #A0A0A2; --header: #79808A; --alt1: #79808A;
      --alt2: #79808A; --alt3: #957A65; --border: #4B4B4B;
      --header-font: 'header'; --mono-font: 'mono';
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg-darkest); color: var(--text); font-family: 'Inter', Arial, sans-serif; font-size: 1rem; line-height: 1.6; }
    .analytics { max-width: 1024px; margin: 0 auto; padding: 2.5rem 1.5rem; }
    .title { font-family: var(--header-font); font-size: 175%; color: var(--header); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
    .days-nav { display: flex; gap: 1.5rem; margin-bottom: 3rem; flex-wrap: wrap; }
    .days-nav a { color: var(--alt1); text-decoration: none; font-size: 100%; border: none; }
    .days-nav a.active, .days-nav a:hover { color: var(--alt3); }
    .summary { display: flex; flex-wrap: wrap; gap: 2rem 3rem; margin: 1rem 0 3rem; }
    .summary strong { display: block; font-size: 275%; line-height: 1; color: var(--header); font-family: var(--header-font); font-weight: 600; }
    .summary span { color: var(--alt1); font-size: 85%; text-transform: uppercase; letter-spacing: 0.08em; }
    h2 { margin: 3rem 0 0.75rem; font-size: 82.5%; color: var(--alt1); letter-spacing: 0.15em; text-transform: uppercase; padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.06); font-family: var(--header-font); font-weight: normal; }
    .bar-wrap { display: flex; align-items: center; gap: 1rem; padding: 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .bar-wrap:hover .label { color: var(--alt3); }
    .bar-wrap .label { color: var(--text); flex: 1; font-size: 100%; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-wrap .bar { height: 2px; background: var(--alt3); min-width: 2px; flex-shrink: 0; opacity: 0.5; }
    .bar-wrap .count { color: var(--alt1); min-width: 2rem; text-align: right; font-family: var(--mono-font); font-size: 100%; }
    .heatmap { display: grid; grid-template-columns: repeat(24, 1fr); gap: 3px; margin: 0.5rem 0; }
    .heatmap-cell { height: 28px; background: var(--alt3); border-radius: 2px; cursor: default; }
    .heatmap-labels { display: grid; grid-template-columns: repeat(24, 1fr); gap: 3px; margin-bottom: 1rem; }
    .heatmap-labels span { font-size: 55%; color: var(--alt1); text-align: center; font-family: var(--mono-font); }
    .hit { display: flex; gap: 0.75rem; padding: 0.5rem 0; font-size: 100%; border-bottom: 1px solid rgba(255,255,255,0.04); align-items: baseline; flex-wrap: wrap; }
    .hit:hover .path { color: var(--alt3); }
    .hit .time { color: var(--alt1); font-family: var(--mono-font); white-space: nowrap; flex-shrink: 0; }
    .hit .flag { flex-shrink: 0; }
    .hit .city { color: var(--alt2); white-space: nowrap; flex-shrink: 0; }
    .hit .path { color: var(--text); word-break: break-all; }
    .hit .ref { color: var(--alt1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: none; }
    @media (min-width: 600px) { .hit .ref { display: block; flex-shrink: 0; max-width: 10rem; } }
  </style>
</head>
<body>
<div class="analytics">
  <p class="title">analytics</p>
  <nav class="days-nav">
    <a href="?days=1${tokenParam}" ${days === 1 ? 'class="active"' : ''}>today</a>
    <a href="?days=3${tokenParam}" ${days === 3 ? 'class="active"' : ''}>3d</a>
    <a href="?days=7${tokenParam}" ${days === 7 ? 'class="active"' : ''}>week</a>
    <a href="?days=30${tokenParam}" ${days === 30 ? 'class="active"' : ''}>month</a>
    <a href="?days=365${tokenParam}" ${days === 365 ? 'class="active"' : ''}>year</a>
  </nav>

  <div class="summary">
    <div><strong>${totalHits}</strong><span>hits</span></div>
    <div><strong>${uniqueIps}</strong><span>unique</span></div>
    <div><strong>${data.length}</strong><span>days</span></div>
    <div><strong>${totalBots}</strong><span title="bot probe attempts">🤖 bots</span></div>
    ${blogRss ? `<div><strong>${blogRss}</strong><span title="blog RSS feed fetches">📡 rss</span></div>` : ''}
    ${podRss ? `<div><strong>${podRss}</strong><span title="podcast feed fetches">🎙️ podcast</span></div>` : ''}
  </div>

  <h2>activity by hour</h2>
  <div class="heatmap">${buildHeatmap(allHits)}</div>
  <div class="heatmap-labels">${Array.from({ length: 24 }, (_, i) => {
    const label = i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`
    return `<span>${label}</span>`
  }).join('')}</div>

  <h2>top pages</h2>
  <div>
    ${topPaths.map(([path, count]) => `
    <div class="bar-wrap" title="${path}">
      <span class="label">${path}</span>
      <div class="bar" style="width:${Math.round(count / (topPaths[0]?.[1] || 1) * 120)}px"></div>
      <span class="count">${count}</span>
    </div>`).join('')}
  </div>

  <h2>top countries</h2>
  <div>
    ${topCountries.map(([country, count]) => `
    <div class="bar-wrap" title="${country}">
      <span class="label">${countryFlag(country)}${country}</span>
      <div class="bar" style="width:${Math.round(count / (topCountries[0]?.[1] || 1) * 120)}px"></div>
      <span class="count">${count}</span>
    </div>`).join('')}
  </div>

  <h2>top referrers</h2>
  <div>
    ${topRefs.map(([ref, count]) => `
    <div class="bar-wrap" title="${ref}">
      <span class="label">${ref}</span>
      <div class="bar" style="width:${Math.round(count / (topRefs[0]?.[1] || 1) * 120)}px"></div>
      <span class="count">${count}</span>
    </div>`).join('')}
  </div>

  ${topPodApps.length ? `
  <h2>🎙️ podcast apps</h2>
  <div>
    ${topPodApps.map(([app, count]) => `
    <div class="bar-wrap" title="${app}">
      <span class="label">${app}</span>
      <div class="bar" style="width:${Math.round(count / (topPodApps[0]?.[1] || 1) * 120)}px"></div>
      <span class="count">${count}</span>
    </div>`).join('')}
  </div>` : ''}

  <h2>hits</h2>
  <div class="hits-list">
    ${allHits.slice().reverse().map(h => `
    <div class="hit">
      <span class="time" data-ts="${h.ts}"></span>
      <span class="flag">${countryFlag(h.country)}</span>
      <span class="city" title="${h.region || h.country}">${h.city || h.country}</span>
      <span class="path" title="${h.path}">${h.path}</span>
      <span class="ref" title="${h.referrer}">${h.referrer ? (() => { try { return new URL(h.referrer).hostname } catch { return '' } })() : ''}</span>
    </div>`).join('')}
  </div>
</div>
<script>
  // render hit times in local timezone
  document.querySelectorAll('.time[data-ts]').forEach(el => {
    el.textContent = new Date(+el.dataset.ts).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
  })

  // render heatmap in local timezone
  const timestamps = Array.from(document.querySelectorAll('.time[data-ts]')).map(el => +el.dataset.ts)
  const hours = Array(24).fill(0)
  timestamps.forEach(ts => hours[new Date(ts).getHours()]++)
  const max = Math.max(...hours, 1)
  document.querySelectorAll('.heatmap-cell[data-hour]').forEach(el => {
    const hour = +el.dataset.hour
    const count = hours[hour]
    const label = hour === 0 ? '12a' : hour < 12 ? hour + 'a' : hour === 12 ? '12p' : (hour - 12) + 'p'
    const opacity = count === 0 ? 0.05 : 0.15 + (count / max) * 0.85
    el.style.opacity = opacity.toFixed(2)
    el.title = label + ': ' + count + ' hits'
  })
</script>
</body>
</html>`
}
