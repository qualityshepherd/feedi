let _token = localStorage.getItem('feedi_token') || null
export const getToken = () => _token
export const setToken = (t) => {
  _token = t
  if (t) localStorage.setItem('feedi_token', t)
  else localStorage.removeItem('feedi_token')
}

export const $ = id => document.getElementById(id)
export const escHtml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const slugify = s => s.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-').replace(/^-+|-+$/g, '')
export const showError = (id, msg) => { const el = $(id); el.textContent = msg; el.classList.remove('hidden') }
export const download = (filename, content, type) => {
  const url = URL.createObjectURL(new Blob([content], { type }))
  Object.assign(document.createElement('a'), { href: url, download: filename }).click()
  URL.revokeObjectURL(url)
}
export const normalizeDate = (d) => {
  if (!d) return ''
  const [y, m, day] = String(d).split('-')
  if (!y || !m || !day) return d
  return `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`
}
export const timeAgo = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
}
export const statusDot = (s) => {
  if (!s) return '<span class="status-dot status-null" title="never fetched"></span>'
  if (s.code === null || s.code === 0) {
    const title = s.error ? `error: ${s.error}` : 'never fetched'
    return `<span class="status-dot status-error" title="${escHtml(title)}${s.fetched ? ` · ${timeAgo(s.fetched)}` : ''}"></span>`
  }
  const cls = s.code === 200 ? 'status-ok' : s.code === 429 ? 'status-warn' : s.code >= 400 ? 'status-error' : 'status-null'
  const label = s.code === 429 ? '429 Rate Limited' : s.code >= 500 ? `${s.code} Server Error` : s.code >= 400 ? `${s.code} Error` : `${s.code} OK`
  return `<span class="status-dot ${cls}" title="${label}${s.fetched ? ` · ${timeAgo(s.fetched)}` : ''}"></span>`
}
export const parseMarkdown = (md) => md
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/^### (.+)$/gm, '<h3>$1</h3>')
  .replace(/^## (.+)$/gm, '<h2>$1</h2>')
  .replace(/^# (.+)$/gm, '<h1>$1</h1>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="preview-img">')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  .replace(/^---$/gm, '<hr>')
  .replace(/\n{2,}/g, '</p><p>')
  .replace(/^(?!<[h1-6|p|hr])(.+)$/gm, '$1')
  .replace(/^<\/p><p>/, '')
  .replace(/(.+)$/, '<p>$1</p>')

export const api = async (method, path, body) => {
  const opts = { method, headers: {} }
  if (_token) opts.headers.Authorization = `Bearer ${_token}`
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body) }
  const res = await fetch(path, opts)
  return res.json().catch(() => ({ error: 'invalid response' }))
}

export const ICON_PENCIL = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>'
export const ICON_EXTERNAL = '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M19 19H5V5h7V3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>'
export const ICON_TRASH = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>'
export const ICON_CHECK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>'
export const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>'
