export const escXml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const stripTags = (s = '') =>
  s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
