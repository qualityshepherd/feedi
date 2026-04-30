import { $, escHtml, getToken } from './admin-utils.js'

let analyticsDays = 1
let analyticsActiveIp = null
let analyticsSessions = []

const ANALYTICS_SESSION_GAP = 30 * 60 * 1000
const ANALYTICS_DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const fmt = n => n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)
const pct = (n, total) => Math.round(n / total * 100) + '%'
const flag = code => code?.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0))) || ''

const aBar = (label, count, max) => `
  <div class="a-bar">
    <span class="a-bar-label" title="${escHtml(String(label))}">${escHtml(String(label))}</span>
    <div class="a-bar-line" style="width:${Math.round(count / max * 120)}px"></div>
    <span class="a-bar-count">${count}</span>
  </div>`

const analyticsHeatmap = (data, labels, cols) => {
  const max = Math.max(...data, 1)
  const cells = data.map((c, i) => {
    const op = c === 0 ? 0.05 : (0.15 + (c / max) * 0.85).toFixed(2)
    return `<div class="a-heatmap-cell" style="opacity:${op}" title="${labels[i]}: ${c}"></div>`
  }).join('')
  const lbls = labels.map(l => `<span class="a-heatmap-label">${l}</span>`).join('')
  return `<div class="a-heatmap-grid" style="grid-template-columns:repeat(${cols},1fr)">${cells}</div>` +
    `<div class="a-heatmap-labels" style="grid-template-columns:repeat(${cols},1fr)">${lbls}</div>`
}

const analyticsAggregate = (allData) => {
  let totalHits = 0; let totalBots = 0; let totalUniques = 0
  const byPath = {}; const byCountry = {}; const byPathBots = {}; const byRss = {}; const byDevice = { mobile: 0, desktop: 0 }
  const byHour = Array(24).fill(0); const byDow = Array(7).fill(0)
  const recentHits = []
  const ipDayCounts = {}
  for (const { data: d } of allData) {
    if (!d) continue
    totalHits += d.totalHits || 0
    totalBots += d.bots || 0
    const u = d.uniques
    if (Array.isArray(u)) {
      totalUniques += u.length
      for (const ip of u) ipDayCounts[ip] = (ipDayCounts[ip] || 0) + 1
    } else {
      totalUniques += typeof u === 'number' ? u : 0
    }
    for (const [k, v] of Object.entries(d.byPath || {})) byPath[k] = (byPath[k] || 0) + v
    for (const [k, v] of Object.entries(d.byCountry || {})) byCountry[k] = (byCountry[k] || 0) + v
    for (const [k, v] of Object.entries(d.byPathBots || {})) {
      if (!byPathBots[k]) byPathBots[k] = { count: 0, asns: [] }
      byPathBots[k].count += v.count
      for (const asn of (v.asns || [])) { if (!byPathBots[k].asns.includes(asn)) byPathBots[k].asns.push(asn) }
    }
    for (const [feed, v] of Object.entries(d.byRss || {})) {
      if (!byRss[feed]) byRss[feed] = { hits: 0, subscribers: 0 }
      byRss[feed].hits += v.hits || 0
      byRss[feed].subscribers = Math.max(byRss[feed].subscribers, v.subscribers || 0)
    }
    byDevice.mobile += d.byDevice?.mobile || 0
    byDevice.desktop += d.byDevice?.desktop || 0
    ;(d.byHour || []).forEach((c, i) => { byHour[i] += c })
    ;(d.byDow || []).forEach((c, i) => { byDow[i] += c })
    recentHits.push(...(d.recentHits || []))
  }
  recentHits.sort((a, b) => b.ts - a.ts)
  const returning = Object.values(ipDayCounts).filter(c => c > 1).length
  return { totalHits, totalBots, totalUniques, returning, byPath, byCountry, byPathBots, byRss, byDevice, byHour, byDow, recentHits }
}

const analyticsGroupSessions = (hits) => {
  const byIp = {}
  for (const h of hits) { if (!byIp[h.ip]) byIp[h.ip] = []; byIp[h.ip].push(h) }
  const sessions = []
  for (const ipHits of Object.values(byIp)) {
    ipHits.sort((a, b) => a.ts - b.ts)
    let session = null
    for (const h of ipHits) {
      if (!session || h.ts - session.lastTs > ANALYTICS_SESSION_GAP) {
        session = { ts: h.ts, lastTs: h.ts, ip: h.ip, country: h.country, region: h.region, city: h.city, referrer: h.referrer || '', paths: [], pathTs: [] }
        sessions.push(session)
      }
      session.lastTs = h.ts
      session.paths.push(h.path)
      session.pathTs.push(h.ts)
    }
  }
  return sessions.sort((a, b) => b.ts - a.ts)
}

const analyticsRenderSessions = () => {
  const logsEl = document.getElementById('analytics-logs')
  const filterEl = document.getElementById('analytics-filter')
  if (!logsEl) return
  const sessions = analyticsActiveIp ? analyticsSessions.filter(s => s.ip === analyticsActiveIp) : analyticsSessions.slice(0, 200)
  filterEl.innerHTML = (analyticsActiveIp && sessions[0])
    ? `<span style="color:var(--color-accent)">${flag(sessions[0].country)} ${escHtml(sessions[0].city || '?')}</span> <a style="cursor:pointer;color:var(--color-text-muted)" onclick="analyticsFilterIp(null)">✕ clear</a>`
    : ''
  if (!sessions.length) { logsEl.innerHTML = ''; return }
  logsEl.innerHTML = sessions.flatMap(s => {
    const entries = analyticsActiveIp
      ? s.paths.map((p, j) => ({ p, ts: s.pathTs[j], country: s.country, region: s.region, city: s.city, ip: s.ip, count: 1 }))
      : [{ p: s.paths[0] || '', ts: s.ts, country: s.country, region: s.region, city: s.city, ip: s.ip, count: s.paths.length }]
    return entries.map(({ p, ts, country, region, city, count, ip }) => {
      const d = new Date(ts)
      const tsStr = (analyticsDays > 1 ? d.toLocaleDateString('en', { month: 'short', day: 'numeric' }) + ' · ' : '') +
        d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit' })
      const clickable = analyticsActiveIp || count > 1
      const onclick = analyticsActiveIp ? 'analyticsFilterIp(null)' : `analyticsFilterIp('${escHtml(s.ip)}')`
      const locTip = [city, region && region !== '?' ? region : null, country].filter(Boolean).join(', ')
      const flagHtml = country ? `<span class="a-flag-emoji" title="${escHtml(locTip)}">${flag(country)}</span> ` : ''
      return `<div class="a-hit">
        <span class="a-ts" title="${escHtml(ip || '')}">${tsStr}</span>
        <span class="a-city${clickable ? ' multi' : ''}" onclick="${clickable ? onclick : ''}" title="${escHtml(locTip)}">${flagHtml}${escHtml(city || '?')}${count > 1 ? ` (${count})` : ''}</span>
        <span class="a-path" title="${escHtml(p)}">${escHtml(p)}</span>
      </div>`
    })
  }).join('')
}

window.analyticsFilterIp = (ip) => { analyticsActiveIp = ip; analyticsRenderSessions() }

document.addEventListener('click', e => {
  const wrap = e.target.closest('.a-tip-wrap')
  document.querySelectorAll('.a-tip-wrap.open').forEach(el => { if (el !== wrap) el.classList.remove('open') })
  if (wrap) wrap.classList.toggle('open')
})

document.querySelectorAll('[data-days]').forEach(btn => btn.addEventListener('click', async () => {
  analyticsDays = parseInt(btn.dataset.days)
  analyticsActiveIp = null
  await renderAnalytics()
}))

export async function renderAnalytics () {
  const el = $('analytics-body')
  el.innerHTML = '<p class="muted">loading…</p>'
  document.querySelectorAll('[data-days]').forEach(b => b.classList.toggle('active', parseInt(b.dataset.days) === analyticsDays))
  const res = await fetch(`/api/analytics?days=${analyticsDays}`, { headers: { Authorization: `Bearer ${getToken()}` } })
  if (!res.ok) { el.innerHTML = '<p class="error">failed to load analytics</p>'; return }
  const allData = await res.json()
  if (!Array.isArray(allData) || !allData.length) { el.innerHTML = '<p class="muted">no data yet</p>'; return }

  const s = analyticsAggregate(allData)
  analyticsSessions = analyticsGroupSessions(s.recentHits)

  const topPaths = Object.entries(s.byPath).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topCountries = Object.entries(s.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const totalDevice = s.byDevice.mobile + s.byDevice.desktop || 1
  const rssEntries = Object.entries(s.byRss).sort((a, b) => b[1].subscribers - a[1].subscribers)
  const totalSubs = rssEntries.reduce((n, [, v]) => n + v.subscribers, 0)
  const hourLabels = Array.from({ length: 24 }, (_, i) => i === 0 ? '12a' : i < 12 ? `${i}` : i === 12 ? '12p' : `${i - 12}`)

  el.innerHTML = `
    <div class="a-stats">
      <div class="a-stat"><div class="a-val">${fmt(s.totalHits)}</div><div class="a-lbl">hits</div></div>
      <div class="a-stat"><div class="a-val">${fmt(s.totalUniques)}</div><div class="a-lbl">unique</div></div>
      ${s.returning > 0 ? `<div class="a-stat"><div class="a-val">${fmt(s.returning)}</div><div class="a-lbl">returning</div></div>` : ''}
      <div class="a-stat"><div class="a-val">${allData.length}</div><div class="a-lbl">days</div></div>
      <div class="a-stat a-tip-wrap"><div class="a-val">${fmt(s.totalBots)}</div><div class="a-lbl">🤖 bots</div><div class="a-tip">${
        Object.entries(s.byPathBots).sort((a, b) => b[1].count - a[1].count).slice(0, 10).map(([p, v]) =>
          `<div class="a-tip-row"><span class="a-tip-path">${escHtml(p)}</span><span class="a-tip-count">${v.count}</span></div>`
        ).join('') || '<div class="a-tip-row"><span>no bot data</span></div>'
      }</div></div>
      <div class="a-stat"><div class="a-val">${pct(s.byDevice.mobile, totalDevice)}</div><div class="a-lbl">📱 mobile</div></div>
      ${totalSubs > 0 ? `<div class="a-stat"><div class="a-val">${fmt(totalSubs)}</div><div class="a-lbl">📡 rss</div></div>` : ''}
    </div>
    <div class="flex gap-6 mb-3 flex-wrap items-end">
      <div class="a-heatmap-dow">${analyticsHeatmap(s.byDow, ANALYTICS_DOW, 7)}</div>
      <div class="a-heatmap-hour">${analyticsHeatmap(s.byHour, hourLabels, 24)}</div>
    </div>
    <div class="flex gap-8 flex-wrap mt-4">
      <div class="a-col">
        <div class="a-section">top paths</div>
        ${topPaths.map(([p, c]) => aBar(p, c, topPaths[0][1])).join('') || '<p class="muted">no data</p>'}
      </div>
      <div class="a-col">
        <div class="a-section">top countries</div>
        ${topCountries.map(([code, c]) => aBar(flag(code) + ' ' + code, c, topCountries[0][1])).join('') || '<p class="muted">no data</p>'}
      </div>
    </div>
    ${analyticsSessions.length
? `
    <div class="a-section">recent hits</div>
    <div id="analytics-filter" class="a-filter"></div>
    <div id="analytics-logs"></div>`
: ''}
  `
  analyticsRenderSessions()
}
