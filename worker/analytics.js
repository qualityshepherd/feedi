import config from '../feedi.config.js'

const SKIP_PATHS = [
  '/.well-known', '/actor', '/api', '/favicon', '/robots.txt',
  '/index.json', '/feedIndex.json', '/feeds.json', '/sitemap', '/nodeinfo'
]
const SKIP_EXTENSIONS = ['.png', '.jpg', '.svg', '.ico', '.woff', '.woff2', '.otf', '.ttf', '.css', '.js']
const BOT_PATHS = ['.aws', '.php', '.asp', '.aspx', '.env', '.git', 'wp-', 'xmlrpc', 'shell', 'setup',
  'config', 'admin', 'backup', '.sql', 'passwd', 'cgi-bin', 'statistics.json',
  'swagger', 'actuator', 'graphql', 'telescope',
  'security.txt', 'console/', 'server-status', 'login.action',
  'v2/_catalog', 'v2/api-docs', 'v3/api-docs', 'trace.axd',
  '@vite', '.vscode', '.DS_Store', 'META-INF', 'pom.properties',
  'ediscovery', 'ecp/Current', 'https%3A']
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

export const backupKey = (date) => `analytics/${date}.json`

export const freshDay = (date) => ({
  date,
  totalHits: 0,
  bots: 0,
  uniques: 0,
  byPath: {},
  byHour: Array(24).fill(0),
  byDow: Array(7).fill(0),
  byCountry: {},
  byCity: {},
  byReferrer: {},
  recentHits: [],
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
  region: (cf && cf.region) || '?',
  city: (cf && cf.city) || '?',
  referrer
})

const todayStr = () => new Date().toISOString().slice(0, 10)

const hashIp = async (ip) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip))
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
}

const getSiteStub = (req, env) => {
  const id = env.ANALYTICS.idFromName(new URL(req.url).hostname)
  return env.ANALYTICS.get(id)
}

const nextMidnight = () => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 1)
  d.setUTCHours(0, 0, 0, 0)
  return d.getTime()
}

export const applyHit = (day, uniques, hit) => {
  const next = JSON.parse(JSON.stringify(day))
  const nextUniques = new Set(uniques)

  if (hit.bot) {
    next.bots++
    return { day: next, uniques: nextUniques }
  }

  if (hit.rss) {
    const feed = hit.rss === 'blog' ? next.rss.blog : next.rss.pod
    feed.total++
    if (hit.app) feed.byApp[hit.app] = (feed.byApp[hit.app] || 0) + 1
    return { day: next, uniques: nextUniques }
  }

  next.totalHits++
  nextUniques.add(hit.ip)
  next.uniques = nextUniques.size
  next.byPath[hit.path] = (next.byPath[hit.path] || 0) + 1
  if (hit.hour !== undefined) next.byHour[hit.hour]++
  const dow = new Date(hit.ts).getUTCDay()
  next.byDow[dow] = (next.byDow[dow] || 0) + 1
  if (hit.country) next.byCountry[hit.country] = (next.byCountry[hit.country] || 0) + 1
  if (hit.city) next.byCity[hit.city] = (next.byCity[hit.city] || 0) + 1
  if (hit.referrer) {
    try {
      const ref = new URL(hit.referrer).hostname
      next.byReferrer[ref] = (next.byReferrer[ref] || 0) + 1
    } catch {}
  }

  next.recentHits = [
    { ts: hit.ts, path: hit.path, country: hit.country, region: hit.region, city: hit.city },
    ...(next.recentHits || [])
  ].slice(0, 100)

  return { day: next, uniques: nextUniques }
}

export const serializeDay = (day, uniques) => ({
  ...day,
  _uniqueArr: [...uniques],
  uniques: uniques.size
})

export const deserializeDay = (stored) => {
  const { _uniqueArr, ...day } = stored
  return { day, uniques: new Set(_uniqueArr || []) }
}

// Pure: builds the R2 backup payload from raw storage (bypasses date guard in _load).
// Returns { key, data } or null if nothing stored yet.
export const buildR2Backup = (stored) => {
  if (!stored) return null
  const { day, uniques } = deserializeDay(stored)
  return {
    key: backupKey(day.date),
    data: JSON.stringify({ ...day, uniques: Array.from(uniques) })
  }
}

export class AnalyticsDO {
  constructor (state, env) {
    this.state = state
    this.env = env
  }

  async _load () {
    const today = todayStr()
    const stored = await this.state.storage.get('today')
    if (stored && stored.date === today) return deserializeDay(stored)
    return { day: freshDay(today), uniques: new Set() }
  }

  async _save ({ day, uniques }) {
    await this.state.storage.put('today', serializeDay(day, uniques))
  }

  async _ensureAlarm () {
    const alarm = await this.state.storage.getAlarm()
    if (!alarm) await this.state.storage.setAlarm(nextMidnight())
  }

  async fetch (req) {
    await this._ensureAlarm()
    const url = new URL(req.url)
    if (req.method === 'POST' && url.pathname === '/hit') {
      const hit = await req.json()
      const state = await this._load()
      await this._save(applyHit(state.day, state.uniques, hit))
      return new Response('ok')
    }
    if (req.method === 'POST' && url.pathname === '/ensureAlarm') {
      await this._ensureAlarm()
      return new Response('ok')
    }
    if (req.method === 'GET' && url.pathname === '/today') {
      const { day } = await this._load()
      return new Response(JSON.stringify(day), { headers: { 'Content-Type': 'application/json' } })
    }
    return new Response('not found', { status: 404 })
  }

  async alarm () {
    console.log('Analytics backup alarm fired')
    // Read raw storage — _load() guards on today's date and would return an empty
    // freshDay at midnight when stored.date is still yesterday, losing all data.
    const stored = await this.state.storage.get('today')
    if (!stored) {
      console.log('No analytics data to back up')
      await this.state.storage.setAlarm(nextMidnight())
      return
    }
    const backup = buildR2Backup(stored)
    if (!this.env.R2) {
      console.error('R2 binding missing — skipping backup')
      await this.state.storage.setAlarm(nextMidnight())
      return
    }
    if (backup) {
      try {
        await this.env.R2.put(backup.key, backup.data, {
          httpMetadata: { contentType: 'application/json' }
        })
      } catch (err) {
        console.error('R2 backup failed — keeping DO storage, will retry next alarm:', err)
        await this.state.storage.setAlarm(nextMidnight())
        return
      }
    }
    const nextDate = new Date(stored.date)
    nextDate.setUTCDate(nextDate.getUTCDate() + 1)
    await this._save({ day: freshDay(nextDate.toISOString().slice(0, 10)), uniques: new Set() })
    await this.state.storage.setAlarm(nextMidnight())
  }
}

// Pure: classifies a request path+ua into what kind of hit it is.
// Returns 'skip' | 'rss-blog' | 'rss-pod' | 'bot' | 'hit'
export const classifyHit = (path, ua = '') => {
  if (SKIP_PATHS.some(p => path.startsWith(p))) return 'skip'
  const pathname = path.split('?')[0]
  if (RSS_PATHS.includes(pathname)) return pathname.includes('blog') ? 'rss-blog' : 'rss-pod'
  if (isBot(path, ua)) return 'bot'
  return 'hit'
}

const doHit = async (req, env, body) => {
  const stub = getSiteStub(req, env)
  const res = await stub.fetch('https://do.local/hit', { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) console.error('Analytics DO returned', res.status, 'for', JSON.stringify(body))
}

export async function trackHit (req, env) {
  if (!config.analytics) return
  const url = new URL(req.url)
  // beacon POSTs pass the real SPA path via ?path= since worker can't see client-side navigation
  const path = url.searchParams.get('path') || (url.pathname + (url.search || ''))
  const ip = req.headers.get('cf-connecting-ip') || ''
  const ua = req.headers.get('user-agent') || ''
  const kind = classifyHit(path, ua)

  if (kind === 'skip') return

  try {
    if (kind === 'rss-blog' || kind === 'rss-pod') {
      await doHit(req, env, { rss: kind === 'rss-blog' ? 'blog' : 'pod', app: detectPodApp(ua) })
      return
    }

    if (kind === 'bot') {
      const ipHash = await hashIp(ip)
      const cacheKey = new Request('https://bot-throttle.local/' + ipHash)
      const cache = caches.default
      if (await cache.match(cacheKey)) return
      await cache.put(cacheKey, new Response('1', { headers: { 'Cache-Control': 'max-age=600' } }))
      await doHit(req, env, { bot: true })
      return
    }

    const cf = req.cf || {}
    const ipHash = await hashIp(ip)
    const hit = buildHit(path, cf, ipHash, req.headers.get('referer') || '')
    await doHit(req, env, hit)
  } catch (err) {
    console.error('Analytics trackHit failed', kind, path, err)
  }
}

export async function handleAnalytics (req, env, hostname) {
  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') || '7')
  const secret = url.searchParams.get('secret')

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
    return new Response(buildDashboard(result, days, secret, hostname), {
      headers: { 'Content-Type': 'text/html' }
    })
  }

  return new Response(JSON.stringify(result, null, 2), { headers: { 'Content-Type': 'application/json' } })
}

function buildDashboard (allData, days, secret, hostname) {
  const flag = (code) => {
    if (!code || code === '?') return ''
    const f = code.toUpperCase().replace(/./g, c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    return `<span title="${code}">${f}</span> `
  }
  const flagWithRegion = (code, region) => {
    if (!code || code === '?') return ''
    const f = code.toUpperCase().replace(/./g, c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    const label = (region && region !== '?') ? `${region}, ${code}` : code
    return `<span title="${label}">${f}</span> `
  }
  const tokenParam = secret ? `&secret=${secret}` : ''
  let totalHits = 0; let totalBots = 0; let totalUniques = 0
  let blogRss = 0; let podRss = 0
  const byPath = {}; const byCountry = {}; const byReferrer = {}
  const byHour = Array(24).fill(0); const byDow = Array(7).fill(0)
  const podApps = {}; const blogApps = {}
  const recentHits = []

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
    ;(data.byDow || []).forEach((c, i) => { byDow[i] += c })
    for (const [k, v] of Object.entries(data.rss?.pod?.byApp || {})) podApps[k] = (podApps[k] || 0) + v
    for (const [k, v] of Object.entries(data.rss?.blog?.byApp || {})) blogApps[k] = (blogApps[k] || 0) + v
    recentHits.push(...(data.recentHits || []))
  }

  recentHits.sort((a, b) => b.ts - a.ts)

  const topPaths = Object.entries(byPath).sort((a, b) => b[1] - a[1]).slice(0, 20)
  const topCountries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topRefs = Object.entries(byReferrer).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topPodApps = Object.entries(podApps).sort((a, b) => b[1] - a[1])
  const topBlogApps = Object.entries(blogApps).sort((a, b) => b[1] - a[1])

  const maxHour = Math.max(...byHour, 1)
  const maxDow = Math.max(...byDow, 1)
  const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  const dowHtml = byDow.map((count, d) => {
    const opacity = count === 0 ? 0.05 : (0.15 + (count / maxDow) * 0.85).toFixed(2)
    return `<div class="heatmap-cell" style="opacity:${opacity}" title="${DOW[d]}: ${count}"></div>`
  }).join('')

  const hourHtml = byHour.map((count, hour) => {
    const label = hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`
    const opacity = count === 0 ? 0.05 : (0.15 + (count / maxHour) * 0.85).toFixed(2)
    return `<div class="heatmap-cell" style="opacity:${opacity}" title="${label}: ${count}"></div>`
  }).join('')

  const logsHtml = recentHits.slice(0, 100).map(h =>
    '<div class="log-row">' +
    `<span class="log-ts" data-ts="${h.ts}" data-days="${days}"></span>` +
    `<span class="log-flag">${flagWithRegion(h.country, h.region)}</span>` +
    `<span class="log-city">${h.city || '?'}</span>` +
    `<span class="log-path">${h.path}</span>` +
    '</div>'
  ).join('')

  const bars = (items, isCountry = false) => items.map(([name, count]) =>
    `<div class="bar-wrap" title="${name}">` +
    `<span class="label">${isCountry ? flag(name) : ''}${name}</span>` +
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
.analytics{max-width:800px;margin:0 auto;padding:2.5rem 1.5rem}
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
.maps{display:grid;grid-template-columns:7fr 24fr;gap:1rem;margin:.5rem 0 1.5rem;align-items:end}
.heatmap{display:grid;gap:3px}
.heatmap.dow{grid-template-columns:repeat(7,1fr)}
.heatmap.hour{grid-template-columns:repeat(24,1fr)}
.heatmap-cell{height:18px;background:var(--alt3);border-radius:2px}
.heatmap-labels{display:grid;gap:3px;margin-top:3px}
.heatmap-labels.dow{grid-template-columns:repeat(7,1fr)}
.heatmap-labels.hour{grid-template-columns:repeat(24,1fr)}
.heatmap-labels span{font-size:55%;color:var(--alt1);text-align:center;font-family:mono}
.log-row{display:grid;grid-template-columns:9rem 1.5rem 8rem 1fr;gap:.75rem;padding:.35rem 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:85%;font-family:mono}
.log-ts{color:var(--alt1)}.log-flag{text-align:center}.log-city{color:var(--alt1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.log-path{color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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
  <div><strong>${blogRss}</strong><span>📡 rss${topBlogApps.length ? ' · ' + topBlogApps.slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ') : ''}</span></div>
  <div><strong>${podRss}</strong><span>🎙️ podcast${topPodApps.length ? ' · ' + topPodApps.slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ') : ''}</span></div>
</div>
<div class="maps">
  <div>
    <div class="heatmap dow">${dowHtml}</div>
    <div class="heatmap-labels dow">${DOW.map(d => `<span>${d}</span>`).join('')}</div>
  </div>
  <div>
    <div class="heatmap hour">${hourHtml}</div>
    <div class="heatmap-labels hour">${Array.from({ length: 24 }, (_, i) => `<span>${i === 0 ? '12a' : i < 12 ? i + 'a' : i === 12 ? '12p' : (i - 12) + 'p'}</span>`).join('')}</div>
  </div>
</div>
<h2>top pages</h2><div>${bars(topPaths)}</div>
<h2>top countries</h2><div>${bars(topCountries, true)}</div>
<h2>top referrers</h2><div>${bars(topRefs)}</div>
${topPodApps.length ? `<h2>🎙️ podcast apps</h2><div>${bars(topPodApps)}</div>` : ''}
${logsHtml ? `<h2>recent hits</h2><div>${logsHtml}</div>` : ''}
</div>
<script>
document.querySelectorAll('.log-ts[data-ts]').forEach(el => {
  const ts = parseInt(el.dataset.ts)
  const d = new Date(ts)
  const date = parseInt(el.dataset.days) > 1 ? d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) + ' · ' : ''
  el.textContent = date + d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
})
</script></body></html>`
}
