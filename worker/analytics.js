import config from '../feedi.config.js'

const SKIP_PATHS = [
  '/.well-known', '/actor', '/api', '/favicon', '/robots.txt',
  '/index.json', '/feedIndex.json', '/feeds.json', '/sitemap'
]
const SKIP_EXTENSIONS = ['.png', '.jpg', '.svg', '.ico', '.woff', '.woff2', '.otf', '.ttf', '.css', '.js']
const BOT_PATHS = ['.php', '.asp', '.aspx', '.env', '.git', 'wp-', 'xmlrpc', 'shell', 'setup',
  'config', 'admin', 'backup', '.sql', 'passwd', 'cgi-bin', 'statistics.json',
  'swagger', 'actuator', 'graphql', 'telescope']
const RSS_PATHS = ['/assets/rss/blog.xml', '/assets/rss/pod.xml']
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

export const backupKey = (date) => `feedi-backups/analytics-${date}.json`

export const freshDay = (date) => ({
  date,
  totalHits: 0,
  bots: 0,
  uniques: 0,
  byPath: {},
  byHour: Array(24).fill(0),
  byCountry: {},
  byCity: {},
  byReferrer: {},
  rss: {
    blog: { total: 0, byApp: {} },
    pod: { total: 0, byApp: {} }
  }
})

export const buildHit = (path, cf = {}, ipHash, referrer = '', ts = Date.now()) => ({
  path,
  ts,
  ip: ipHash,
  hour: new Date(ts).getUTCHours(),
  country: (cf && cf.country) || '?',
  city: (cf && cf.city) || '?',
  referrer
})

const todayStr = () => new Date().toISOString().slice(0, 10)

const nextMidnight = () => {
  const d = new Date()
  d.setUTCHours(24, 0, 0, 0)
  return d.getTime()
}

export class AnalyticsDO {
  constructor (state, env) {
    this.state = state
    this.env = env
    this._data = null
    this._uniques = null
  }

  async _init () {
    if (this._data) return
    const today = todayStr()
    const stored = await this.state.storage.get('today')
    if (stored && stored.date === today) {
      this._data = stored
      this._uniques = new Set(stored._uniqueArr || [])
    } else {
      this._data = freshDay(today)
      this._uniques = new Set()
    }
    const alarm = await this.state.storage.getAlarm()
    if (!alarm) await this.state.storage.setAlarm(nextMidnight())
  }

  async _persist () {
    this._data._uniqueArr = [...this._uniques]
    this._data.uniques = this._uniques.size
    await this.state.storage.put('today', this._data)
  }

  async fetch (req) {
    await this._init()
    const url = new URL(req.url)

    if (req.method === 'POST' && url.pathname === '/hit') {
      const hit = await req.json()
      this._recordHit(hit)
      await this._persist()
      return new Response('ok')
    }

    if (req.method === 'GET' && url.pathname === '/today') {
      const out = { ...this._data }
      delete out._uniqueArr
      return new Response(JSON.stringify(out), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response('not found', { status: 404 })
  }

  _recordHit (hit) {
    const today = todayStr()
    if (this._data.date !== today) {
      this._data = freshDay(today)
      this._uniques = new Set()
    }

    if (hit.bot) {
      this._data.bots++
      return
    }

    if (hit.rss) {
      const feed = hit.rss === 'blog' ? this._data.rss.blog : this._data.rss.pod
      feed.total++
      if (hit.app) feed.byApp[hit.app] = (feed.byApp[hit.app] || 0) + 1
      return
    }

    this._data.totalHits++
    this._uniques.add(hit.ip)
    this._data.uniques = this._uniques.size
    this._data.byPath[hit.path] = (this._data.byPath[hit.path] || 0) + 1
    if (hit.hour !== undefined) this._data.byHour[hit.hour]++
    if (hit.country) this._data.byCountry[hit.country] = (this._data.byCountry[hit.country] || 0) + 1
    if (hit.city) this._data.byCity[hit.city] = (this._data.byCity[hit.city] || 0) + 1
    if (hit.referrer) {
      try {
        const ref = new URL(hit.referrer).hostname
        this._data.byReferrer[ref] = (this._data.byReferrer[ref] || 0) + 1
      } catch {}
    }
  }

  async alarm () {
    await this._init()
    await this._flushToR2()
    const today = todayStr()
    this._data = freshDay(today)
    this._uniques = new Set()
    await this._persist()
    await this.state.storage.setAlarm(nextMidnight())
  }

  async _flushToR2 () {
    if (!this.env.R2) return
    const out = { ...this._data }
    delete out._uniqueArr
    await this.env.R2.put(backupKey(this._data.date), JSON.stringify(out), {
      httpMetadata: { contentType: 'application/json' }
    })
  }
}

async function hashIp (ip) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
}

function getSiteStub (env) {
  const id = env.ANALYTICS.idFromName(config.domain)
  return env.ANALYTICS.get(id)
}

export async function trackHit (req, env) {
  if (!config.analytics) return

  const url = new URL(req.url)
  const path = url.pathname + (url.search || '')
  if (SKIP_PATHS.some(p => path.startsWith(p))) return

  const ip = req.headers.get('cf-connecting-ip') || ''
  const ua = req.headers.get('user-agent') || ''

  // RSS hit — classify UA only, no raw string stored
  if (RSS_PATHS.includes(url.pathname)) {
    const stub = getSiteStub(env)
    await stub.fetch('https://do.local/hit', {
      method: 'POST',
      body: JSON.stringify({
        rss: url.pathname.includes('blog') ? 'blog' : 'pod',
        app: detectPodApp(ua)
      })
    })
    return
  }

  // bot — throttle via Cache API, count in DO
  if (isBot(path, ua)) {
    const ipHash = await hashIp(ip)
    const cacheKey = new Request('https://bot-throttle.local/' + ipHash)
    const cache = caches.default
    if (await cache.match(cacheKey)) return
    await cache.put(cacheKey, new Response('1', { headers: { 'Cache-Control': 'max-age=600' } }))
    const stub = getSiteStub(env)
    await stub.fetch('https://do.local/hit', {
      method: 'POST',
      body: JSON.stringify({ bot: true })
    })
    return
  }

  const cf = req.cf || {}
  const ipHash = await hashIp(ip)
  const hit = buildHit(path, cf, ipHash, req.headers.get('referer') || '')

  try {
    const stub = getSiteStub(env)
    await stub.fetch('https://do.local/hit', {
      method: 'POST',
      body: JSON.stringify(hit)
    })
  } catch (err) {
    console.error('Analytics write failed:', err)
  }
}

// called from index.js after token validation
export async function handleAnalytics (req, env, hostname) {
  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') || '7')
  const token = url.searchParams.get('token')

  const id = env.ANALYTICS.idFromName(hostname)
  const stub = env.ANALYTICS.get(id)
  const todayRes = await stub.fetch('https://do.local/today')
  const todayData = await todayRes.json()

  const result = [{ date: todayData.date, data: todayData }]

  if (env.R2) {
    for (let i = 1; i < days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      const obj = await env.R2.get(backupKey(dateStr))
      if (obj) result.push({ date: dateStr, data: await obj.json() })
    }
  }

  const accept = req.headers.get('accept') || ''
  if (accept.includes('text/html')) {
    return new Response(buildDashboard(result, days, token, hostname), {
      headers: { 'Content-Type': 'text/html' }
    })
  }

  return new Response(JSON.stringify(result, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  })
}

function buildDashboard (allData, days, token, hostname) {
  const tokenParam = token ? `&token=${token}` : ''
  let totalHits = 0; let totalBots = 0; let totalUniques = 0
  let blogRss = 0; let podRss = 0
  const byPath = {}; const byCountry = {}; const byReferrer = {}
  const byHour = Array(24).fill(0); const podApps = {}

  for (const { data } of allData) {
    if (!data) continue
    totalHits += data.totalHits || 0
    totalBots += data.bots || 0
    totalUniques += data.uniques || 0
    blogRss += data.rss?.blog?.total || 0
    podRss += data.rss?.pod?.total || 0
    for (const [k, v] of Object.entries(data.byPath || {})) byPath[k] = (byPath[k] || 0) + v
    for (const [k, v] of Object.entries(data.byCountry || {})) byCountry[k] = (byCountry[k] || 0) + v
    for (const [k, v] of Object.entries(data.byReferrer || {})) byReferrer[k] = (byReferrer[k] || 0) + v
    ;(data.byHour || []).forEach((c, i) => { byHour[i] += c })
    for (const [k, v] of Object.entries(data.rss?.pod?.byApp || {})) podApps[k] = (podApps[k] || 0) + v
  }

  const topPaths = Object.entries(byPath).sort((a, b) => b[1] - a[1]).slice(0, 20)
  const topCountries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topRefs = Object.entries(byReferrer).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topPodApps = Object.entries(podApps).sort((a, b) => b[1] - a[1])
  const maxHour = Math.max(...byHour, 1)

  const heatmapHtml = byHour.map((count, hour) => {
    const label = hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`
    const opacity = count === 0 ? 0.05 : (0.15 + (count / maxHour) * 0.85).toFixed(2)
    return `<div class="heatmap-cell" style="opacity:${opacity}" title="${label}: ${count}"></div>`
  }).join('')

  const bars = (items, isCountry = false) => items.map(([name, count]) =>
    `<div class="bar-wrap" title="${name}">` +
    `<span class="label">${isCountry ? countryFlag(name) : ''}${name}</span>` +
    `<div class="bar" style="width:${Math.round(count / (items[0]?.[1] || 1) * 120)}px"></div>` +
    `<span class="count">${count}</span></div>`
  ).join('')

  const navLinks = [1, 3, 7, 30, 365].map(d => {
    const label = d === 1 ? 'today' : d === 3 ? '3d' : d === 7 ? 'week' : d === 30 ? 'month' : 'year'
    return `<a href="?days=${d}${tokenParam}"${days === d ? ' class="active"' : ''}>${label}</a>`
  }).join('')

  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>feedi analytics — ${hostname}</title>
<style>
@font-face{font-family:header;src:url(/assets/fonts/Oswald-Regular.ttf) format(truetype)}
@font-face{font-family:Inter;src:url(/assets/fonts/Inter-Regular.woff2) format(woff2)}
@font-face{font-family:mono;src:url(/assets/fonts/intelone-mono-font-family-regular.otf) format(opentype)}
:root{--bg-darkest:#222;--text:#A0A0A2;--header:#79808A;--alt1:#79808A;--alt3:#957A65}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg-darkest);color:var(--text);font-family:Inter,Arial,sans-serif;line-height:1.6}
.analytics{max-width:1024px;margin:0 auto;padding:2.5rem 1.5rem}
.title{font-family:header;font-size:175%;color:var(--header);text-transform:uppercase;letter-spacing:.05em}
.subtitle{color:var(--alt1);font-size:85%;margin-bottom:0}
.days-nav{display:flex;gap:1.5rem;margin:1rem 0 3rem;flex-wrap:wrap}
.days-nav a{color:var(--alt1);text-decoration:none}.days-nav a.active,.days-nav a:hover{color:var(--alt3)}
.summary{display:flex;flex-wrap:wrap;gap:2rem 3rem;margin:1rem 0 3rem}
.summary strong{display:block;font-size:275%;line-height:1;color:var(--header);font-family:header;font-weight:600}
.summary span{color:var(--alt1);font-size:85%;text-transform:uppercase;letter-spacing:.08em}
h2{margin:3rem 0 .75rem;font-size:82.5%;color:var(--alt1);letter-spacing:.15em;text-transform:uppercase;padding-bottom:.5rem;border-bottom:1px solid rgba(255,255,255,.06);font-family:header;font-weight:normal}
.bar-wrap{display:flex;align-items:center;gap:1rem;padding:.5rem 0;border-bottom:1px solid rgba(255,255,255,.04)}
.bar-wrap:hover .label{color:var(--alt3)}
.bar-wrap .label{color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-wrap .bar{height:2px;background:var(--alt3);min-width:2px;flex-shrink:0;opacity:.5}
.bar-wrap .count{color:var(--alt1);min-width:2rem;text-align:right;font-family:mono}
.heatmap{display:grid;grid-template-columns:repeat(24,1fr);gap:3px;margin:.5rem 0}
.heatmap-cell{height:28px;background:var(--alt3);border-radius:2px}
.heatmap-labels{display:grid;grid-template-columns:repeat(24,1fr);gap:3px;margin-bottom:1rem}
.heatmap-labels span{font-size:55%;color:var(--alt1);text-align:center;font-family:mono}
</style></head><body>
<div class="analytics">
<p class="title">analytics</p>
<p class="subtitle">${hostname}</p>
<nav class="days-nav">${navLinks}</nav>
<div class="summary">
  <div><strong>${totalHits}</strong><span>hits</span></div>
  <div><strong>${totalUniques}</strong><span>unique</span></div>
  <div><strong>${allData.length}</strong><span>days</span></div>
  <div><strong>${totalBots}</strong><span>🤖 bots</span></div>
  ${blogRss ? `<div><strong>${blogRss}</strong><span>📡 rss</span></div>` : ''}
  ${podRss ? `<div><strong>${podRss}</strong><span>🎙️ podcast</span></div>` : ''}
</div>
<h2>activity by hour (utc)</h2>
<div class="heatmap">${heatmapHtml}</div>
<div class="heatmap-labels">${Array.from({ length: 24 }, (_, i) => `<span>${i === 0 ? '12a' : i < 12 ? i + 'a' : i === 12 ? '12p' : (i - 12) + 'p'}</span>`).join('')}</div>
<h2>top pages</h2><div>${bars(topPaths)}</div>
<h2>top countries</h2><div>${bars(topCountries, true)}</div>
<h2>top referrers</h2><div>${bars(topRefs)}</div>
${topPodApps.length ? `<h2>🎙️ podcast apps</h2><div>${bars(topPodApps)}</div>` : ''}
</div></body></html>`
}
