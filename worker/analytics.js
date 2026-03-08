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
const BOT_UAS = ['python', 'curl', 'wget', 'go-http', 'libwww', 'node-fetch', 'axios', 'urllib']

export const isBot = (path, ua = '') =>
  BOT_PATHS.some(p => path.toLowerCase().includes(p)) ||
  SKIP_EXTENSIONS.some(e => path.toLowerCase().split('?')[0].endsWith(e)) ||
  BOT_UAS.some(b => ua.toLowerCase().includes(b))

export const countryFlag = (code) => {
  if (!code || code === '?') return ''
  const flag = code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  )
  return `<span title="${code}">${flag}</span> `
}

export const countryFlagWithRegion = (code, region) => {
  if (!code || code === '?') return ''
  const flag = code.toUpperCase().replace(/./g, c =>
    String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)
  )
  const label = (region && region !== '?') ? `${region}, ${code}` : code
  return `<span title="${label}">${flag}</span> `
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
  recentHits: []
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

export const serializeDay = (day, uniques) => ({
  ...day,
  _uniqueArr: [...uniques],
  uniques: uniques.size
})

export const deserializeDay = (stored) => {
  const { _uniqueArr, ...day } = stored
  return { day, uniques: new Set(_uniqueArr || []) }
}

// Pure: load stored data as-is. Never resets on date change — that's the alarm's job.
export const loadDay = (stored, today) => {
  if (stored) return deserializeDay(stored)
  return { day: freshDay(today || new Date().toISOString().slice(0, 10)), uniques: new Set() }
}

// Pure: advance to next day. Only called by alarm after backup.
export const resetDay = (stored) => {
  const { day } = deserializeDay(stored)
  const next = new Date(day.date)
  next.setUTCDate(next.getUTCDate() + 1)
  return { day: freshDay(next.toISOString().slice(0, 10)), uniques: new Set() }
}

export const applyHit = (day, uniques, hit) => {
  const next = {
    ...day,
    byPath: { ...day.byPath },
    byCountry: { ...day.byCountry },
    byCity: { ...day.byCity },
    byReferrer: { ...day.byReferrer },
    byHour: [...day.byHour],
    byDow: [...day.byDow],
    recentHits: [...(day.recentHits || [])]
  }
  const nextUniques = new Set(uniques)

  if (hit.bot) {
    next.bots++
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

// Pure: build R2 backup payload from raw storage.
export const buildR2Backup = (stored) => {
  if (!stored) return null
  const { day, uniques } = deserializeDay(stored)
  return {
    key: backupKey(day.date),
    data: JSON.stringify({ ...day, uniques: Array.from(uniques) })
  }
}

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

export class AnalyticsDO {
  constructor (state, env) {
    this.state = state
    this.env = env
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
      const stored = await this.state.storage.get('today')
      const state = loadDay(stored)
      const next = applyHit(state.day, state.uniques, hit)
      await this.state.storage.put('today', serializeDay(next.day, next.uniques))
      return new Response('ok')
    }

    if (req.method === 'POST' && url.pathname === '/restore') {
      const data = await req.json()
      await this.state.storage.put('today', data)
      return new Response('ok')
    }

    if (req.method === 'POST' && url.pathname === '/ensureAlarm') {
      await this._ensureAlarm()
      return new Response('ok')
    }

    if (req.method === 'POST' && url.pathname === '/resetAlarm') {
      await this.state.storage.setAlarm(nextMidnight())
      return new Response('ok')
    }

    if (req.method === 'GET' && url.pathname === '/today') {
      const stored = await this.state.storage.get('today')
      const { day } = loadDay(stored)
      return new Response(JSON.stringify(day), { headers: { 'Content-Type': 'application/json' } })
    }

    return new Response('not found', { status: 404 })
  }

  async alarm () {
    console.log('Analytics alarm fired — backing up and resetting')
    const stored = await this.state.storage.get('today')

    if (!stored) {
      console.log('No analytics data to back up')
      await this.state.storage.setAlarm(nextMidnight())
      return
    }

    if (!this.env.R2) {
      console.error('R2 binding missing — skipping backup')
      await this.state.storage.setAlarm(nextMidnight())
      return
    }

    const backup = buildR2Backup(stored)
    if (backup) {
      try {
        await this.env.R2.put(backup.key, backup.data, {
          httpMetadata: { contentType: 'application/json' }
        })
        console.log('Backed up to R2:', backup.key)
      } catch (err) {
        console.error('R2 backup failed — retrying next alarm:', err)
        await this.state.storage.setAlarm(nextMidnight())
        return
      }
    }

    // Only reset AFTER successful R2 write
    const next = resetDay(stored)
    await this.state.storage.put('today', serializeDay(next.day, next.uniques))
    await this.state.storage.setAlarm(nextMidnight())
    console.log('Reset to:', next.day.date)
  }
}

// Pure: classifies a request path+ua.
// Returns 'skip' | 'bot' | 'hit'
export const classifyHit = (path, ua = '') => {
  if (SKIP_PATHS.some(p => path.startsWith(p))) return 'skip'
  if (isBot(path, ua)) return 'bot'
  return 'hit'
}

export async function trackHit (req, env) {
  if (!config.analytics) return
  const url = new URL(req.url)
  const path = url.searchParams.get('path') || (url.pathname + (url.search || ''))
  const ip = req.headers.get('cf-connecting-ip') || ''
  const ua = req.headers.get('user-agent') || ''
  const kind = classifyHit(path, ua)
  if (path.length > 500) return

  if (kind === 'skip') return

  if (kind === 'bot') {
    const ipHash = await hashIp(ip)
    const cacheKey = new Request('https://bot-throttle.local/' + ipHash)
    const cache = caches.default
    if (await cache.match(cacheKey)) return
    await cache.put(cacheKey, new Response('1', { headers: { 'Cache-Control': 'max-age=600' } }))
    const stub = getSiteStub(req, env)
    await stub.fetch('https://do.local/hit', { method: 'POST', body: JSON.stringify({ bot: true }) })
    return
  }

  const cf = req.cf || {}
  const ipHash = await hashIp(ip)
  const referer = req.headers.get('referer') || ''
  let referrer = ''
  try {
    if (referer && new URL(referer).hostname !== new URL(req.url).hostname) referrer = referer
  } catch {}
  const hit = buildHit(path, cf, ipHash, referrer)
  try {
    const stub = getSiteStub(req, env)
    await stub.fetch('https://do.local/hit', { method: 'POST', body: JSON.stringify(hit) })
  } catch (err) { console.error('Analytics write failed:', err) }
}

export async function handleAnalytics (req, env, hostname) {
  const url = new URL(req.url)
  const days = parseInt(url.searchParams.get('days') || '7')

  const accept = req.headers.get('accept') || ''
  if (accept.includes('text/html')) {
    return new Response(ANALYTICS_HTML, { headers: { 'Content-Type': 'text/html' } })
  }

  const id = env.ANALYTICS.idFromName(hostname)
  const stub = env.ANALYTICS.get(id)
  const todayRes = await stub.fetch('https://do.local/today')
  const todayData = await todayRes.json()

  const result = [{ date: todayData.date, data: todayData }]

  if (env.R2) {
    const promises = []
    for (let i = 1; i < days; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().slice(0, 10)
      promises.push(
        env.R2.get(backupKey(dateStr))
          .then(obj => obj ? obj.json().then(data => ({ date: dateStr, data })) : null)
      )
    }
    const historical = (await Promise.all(promises)).filter(Boolean)
    result.push(...historical)
  }

  return new Response(JSON.stringify(result, null, 2), { headers: { 'Content-Type': 'application/json' } })
}

const ANALYTICS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>analytics</title>
<style>
@font-face{font-family:header;src:url(/assets/fonts/Oswald-Regular.ttf) format(truetype)}
@font-face{font-family:Inter;src:url(/assets/fonts/Inter-Regular.woff2) format(woff2)}
@font-face{font-family:mono;src:url(/assets/fonts/intelone-mono-font-family-regular.otf) format(opentype)}
:root{--bg-darkest:#222;--text:#A0A0A2;--header:#79808A;--alt1:#79808A;--alt3:#957A65}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg-darkest);color:var(--text);font-family:Inter,Arial,sans-serif;line-height:1.6}
.wrap{max-width:800px;margin:0 auto;padding:2.5rem 1.5rem}
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
</style>
</head>
<body>
<div class="wrap">
  <p class="title">analytics</p>
  <p class="subtitle" id="hostname"></p>
  <nav class="days-nav" id="nav"></nav>
  <div class="summary" id="summary"></div>
  <div class="maps" id="maps"></div>
  <div id="charts"></div>
  <div id="logs"></div>
</div>
<script>
const params = new URLSearchParams(location.search)
const days = parseInt(params.get('days') || '1')
const secret = params.get('secret') || ''
const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// nav
const tokenParam = secret ? \`&secret=\${secret}\` : ''
document.getElementById('hostname').textContent = location.hostname
document.getElementById('nav').innerHTML = [1, 3, 7, 30, 365].map(d => {
  const label = d === 1 ? 'today' : d === 3 ? '3d' : d === 7 ? 'week' : d === 30 ? 'month' : 'year'
  return \`<a href="?days=\${d}\${tokenParam}"\${days === d ? ' class="active"' : ''}>\${label}</a>\`
}).join('')

const flag = (code) => {
  if (!code || code === '?') return ''
  const f = code.toUpperCase().replace(/./g, c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
  return \`<span title="\${code}">\${f}</span> \`
}

const flagWithRegion = (code, region) => {
  if (!code || code === '?') return ''
  const f = code.toUpperCase().replace(/./g, c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
  const label = (region && region !== '?') ? \`\${region}, \${code}\` : code
  return \`<span title="\${label}">\${f}</span> \`
}

const fmtTs = (ts) => {
  const d = new Date(ts)
  const date = days > 1 ? d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) + ' · ' : ''
  return date + d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
}

const bars = (items, isCountry = false) => items.map(([name, count]) =>
  \`<div class="bar-wrap" title="\${name}">\` +
  \`<span class="label">\${isCountry ? flag(name) : ''}\${name}</span>\` +
  \`<div class="bar" style="width:\${Math.round(count / (items[0]?.[1] || 1) * 120)}px"></div>\` +
  \`<span class="count">\${count}</span></div>\`
).join('')

const heatmap = (data, labels, cls) => {
  const max = Math.max(...data, 1)
  const cells = data.map((count, i) => {
    const opacity = count === 0 ? 0.05 : (0.15 + (count / max) * 0.85).toFixed(2)
    return \`<div class="heatmap-cell" style="opacity:\${opacity}" title="\${labels[i]}: \${count}"></div>\`
  }).join('')
  return \`<div class="heatmap \${cls}">\${cells}</div>\` +
    \`<div class="heatmap-labels \${cls}">\${labels.map(l => \`<span>\${l}</span>\`).join('')}</div>\`
}

// aggregate across all days
const aggregate = (allData) => {
  let totalHits = 0, totalBots = 0, totalUniques = 0
  const byPath = {}, byCountry = {}, byReferrer = {}
  const byHour = Array(24).fill(0), byDow = Array(7).fill(0)
  const recentHits = []

  for (const { data } of allData) {
    if (!data) continue
    totalHits += data.totalHits || 0
    totalBots += data.bots || 0
    totalUniques += data.uniques || 0
    for (const [k, v] of Object.entries(data.byPath || {})) byPath[k] = (byPath[k] || 0) + v
    for (const [k, v] of Object.entries(data.byCountry || {})) byCountry[k] = (byCountry[k] || 0) + v
    for (const [k, v] of Object.entries(data.byReferrer || {})) byReferrer[k] = (byReferrer[k] || 0) + v
    ;(data.byHour || []).forEach((c, i) => { byHour[i] += c })
    ;(data.byDow || []).forEach((c, i) => { byDow[i] += c })
    recentHits.push(...(data.recentHits || []))
  }

  recentHits.sort((a, b) => b.ts - a.ts)
  return { totalHits, totalBots, totalUniques, byPath, byCountry, byReferrer, byHour, byDow, recentHits }
}

const render = (allData) => {
  const s = aggregate(allData)
  const topPaths = Object.entries(s.byPath).sort((a, b) => b[1] - a[1]).slice(0, 20)
  const topCountries = Object.entries(s.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topRefs = Object.entries(s.byReferrer).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const hourLabels = Array.from({length: 24}, (_, i) => i === 0 ? '12a' : i < 12 ? \`\${i}a\` : i === 12 ? '12p' : \`\${i-12}p\`)

  document.getElementById('summary').innerHTML =
    \`<div><strong>\${s.totalHits}</strong><span>hits</span></div>\` +
    \`<div><strong>\${s.totalUniques}</strong><span>unique</span></div>\` +
    \`<div><strong>\${allData.length}</strong><span>days</span></div>\` +
    \`<div><strong>\${s.totalBots}</strong><span>🤖 bots</span></div>\`

  document.getElementById('maps').innerHTML =
    \`<div>\${heatmap(s.byDow, DOW, 'dow')}</div>\` +
    \`<div>\${heatmap(s.byHour, hourLabels, 'hour')}</div>\`

  document.getElementById('charts').innerHTML =
    \`<h2>top pages</h2><div>\${bars(topPaths)}</div>\` +
    \`<h2>top countries</h2><div>\${bars(topCountries, true)}</div>\` +
    \`<h2>top referrers</h2><div>\${bars(topRefs)}</div>\`

  const logsHtml = s.recentHits.slice(0, 100).map(h =>
    \`<div class="log-row">\` +
    \`<span class="log-ts">\${fmtTs(h.ts)}</span>\` +
    \`<span class="log-flag">\${flagWithRegion(h.country, h.region)}</span>\` +
    \`<span class="log-city">\${h.city || '?'}</span>\` +
    \`<span class="log-path">\${h.path}</span>\` +
    \`</div>\`
  ).join('')
  document.getElementById('logs').innerHTML = logsHtml ? \`<h2>recent hits</h2>\${logsHtml}\` : ''
}

fetch(\`/api/analytics?days=\${days}\${tokenParam}\`)
  .then(r => {
    if (r.status === 401) throw new Error('unauthorized')
    if (!r.ok) throw new Error(\`\${r.status}\`)
    return r.json()
  })
  .then(render)
  .catch(err => { document.getElementById('summary').textContent = err.message === 'unauthorized' ? '🔒 add ?secret= to the URL' : 'failed to load' })
</script>
</body>
</html>
`
