import { handleWebfinger, handleActor } from './activitypub.js'
import { trackHit, backupToR2, handleAnalytics } from './analytics.js'

export default {
  async fetch (req, env) {
    const url = new URL(req.url)
    const path = url.pathname

    if (path === '/.well-known/webfinger') return handleWebfinger(req)
    if (path === '/actor') return handleActor()

    if (path === '/api/analytics') {
      return handleAnalytics(req, env)
    }

    await trackHit(req, env)
    return env.ASSETS.fetch(req)
  },

  async scheduled (event, env) {
    if (event.cron === '0 2 * * *') {
      await backupToR2(env)
    }
  }
}
