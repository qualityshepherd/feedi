import { handleWebfinger, handleActor } from './activitypub.js'
import { trackHit, handleAnalytics, AnalyticsDO } from './analytics.js'

export { AnalyticsDO }

export default {
  async fetch (req, env) {
    const url = new URL(req.url)
    const path = url.pathname

    if (path === '/.well-known/webfinger') return handleWebfinger(req)
    if (path === '/actor') return handleActor()

    // analytics dashboard — protected by same ADMIN_SECRET as admin routes
    if (path === '/api/analytics') {
      const secret = url.searchParams.get('secret')
      if (!secret || secret !== env.ADMIN_SECRET) return new Response('Unauthorized', { status: 401 })
      const hostname = url.hostname
      return handleAnalytics(req, env, hostname)
    }

    await trackHit(req, env)
    return env.ASSETS.fetch(req)
  },

}
