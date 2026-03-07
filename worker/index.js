import { handleWebfinger, handleActor } from './activitypub.js'
import { trackHit, handleAnalytics, AnalyticsDO } from './analytics.js'

export { AnalyticsDO }

export const isAuthorized = (secret, adminSecret) =>
  !!secret && !!adminSecret && secret === adminSecret

export default {
  async fetch (req, env, ctx) {
    const url = new URL(req.url)
    const path = url.pathname

    if (path === '/.well-known/webfinger') return handleWebfinger(req)
    if (path === '/actor') return handleActor()

    if (path === '/api/analytics') {
      const secret = url.searchParams.get('secret')
      if (!isAuthorized(secret, env.ADMIN_SECRET)) return new Response('Unauthorized', { status: 401 })
      return handleAnalytics(req, env, url.hostname)
    }

    // SPA beacon — client sends real path via ?path= since worker can't see client-side navigation
    if (path === '/api/beacon' && req.method === 'POST') {
      ctx.waitUntil(trackHit(req, env))
      return new Response(null, { status: 204 })
    }

    // Fire analytics in background
    ctx.waitUntil(trackHit(req, env))

    return env.ASSETS.fetch(req)
  },

  async scheduled (event, env, ctx) {
    // Safety net: if the DO alarm misfired, force a backup via cron
    ctx.waitUntil((async () => {
      try {
        const hostname = new URL(`https://${env.ASSETS_HOST || 'feedi.brine.dev'}`).hostname
        const id = env.ANALYTICS.idFromName(hostname)
        const stub = env.ANALYTICS.get(id)
        // Trigger alarm manually by calling the DO's alarm via a sentinel hit
        // that reschedules if needed
        await stub.fetch('https://do.local/ensureAlarm', { method: 'POST' })
      } catch (err) {
        console.error('Scheduled alarm check failed:', err)
      }
    })())
  }
}
