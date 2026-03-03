const SITE_PREFIX = 'site:'

export const siteKey = (hostname) => `${SITE_PREFIX}${hostname}`

export const generateToken = async () => {
  const key = await crypto.subtle.generateKey(
    { name: 'HMAC', hash: 'SHA-256' },
    true,
    ['sign']
  )
  const raw = await crypto.subtle.exportKey('raw', key)
  return Array.from(new Uint8Array(raw))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

export const registerSite = async (env, hostname) => {
  const token = await generateToken()
  const site = { hostname, token, createdAt: new Date().toISOString() }
  await env.KV.put(siteKey(hostname), JSON.stringify(site))
  return site
}

export const getSites = async (env) => {
  const list = await env.KV.list({ prefix: SITE_PREFIX })
  const sites = await Promise.all(
    list.keys.map(async ({ name }) => {
      const val = await env.KV.get(name, 'json')
      return val ? { hostname: val.hostname, token: val.token, createdAt: val.createdAt } : null
    })
  )
  return sites.filter(Boolean)
}

export const deleteSite = async (env, hostname) => {
  await env.KV.delete(siteKey(hostname))
}

export const validateSiteToken = async (env, token) => {
  const list = await env.KV.list({ prefix: SITE_PREFIX })
  for (const { name } of list.keys) {
    const site = await env.KV.get(name, 'json')
    if (site && site.token === token) return site
  }
  return null
}
