import { handleWebfinger, handleActor } from './activitypub.js'
import { trackHit, handleAnalytics, AnalyticsDO } from './analytics.js'
import { registerSite, getSites, deleteSite, validateSiteToken } from './sites.js'

export { AnalyticsDO }

export default {
  async fetch (req, env) {
    const url = new URL(req.url)
    const path = url.pathname

    if (path === '/.well-known/webfinger') return handleWebfinger(req)
    if (path === '/actor') return handleActor()

    // analytics dashboard — validate site token first
    if (path === '/api/analytics') {
      const token = url.searchParams.get('token')
      if (!token) return new Response('Unauthorized', { status: 401 })
      const site = await validateSiteToken(env, token)
      if (!site) return new Response('Unauthorized', { status: 401 })
      return handleAnalytics(req, env, site.hostname)
    }

    // admin endpoints — protected by ADMIN_SECRET header
    if (path.startsWith('/api/admin/')) {
      const adminToken = req.headers.get('x-admin-secret')
      if (!adminToken || adminToken !== env.ADMIN_SECRET) {
        return new Response('Unauthorized', { status: 401 })
      }

      if (path === '/api/admin/sites' && req.method === 'GET') {
        const sites = await getSites(env)
        return new Response(JSON.stringify(sites), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (path === '/api/admin/sites' && req.method === 'POST') {
        const body = await req.json().catch(() => ({}))
        if (!body.hostname) return new Response('hostname required', { status: 400 })
        const site = await registerSite(env, body.hostname)
        return new Response(JSON.stringify(site), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (path.startsWith('/api/admin/sites/') && req.method === 'DELETE') {
        const hostname = decodeURIComponent(path.replace('/api/admin/sites/', ''))
        await deleteSite(env, hostname)
        return new Response(JSON.stringify({ deleted: hostname }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      return new Response('Not Found', { status: 404 })
    }

    await trackHit(req, env)
    return env.ASSETS.fetch(req)
  },

  async scheduled (_event, _env) {
    // DO alarms handle daily R2 flush — cron kept for manual trigger fallback
  }
}
