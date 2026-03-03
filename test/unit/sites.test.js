import { unit as test } from '../testpup.js'
import { generateToken, siteKey } from '../../worker/sites.js'

// generateToken and siteKey are pure / crypto-only — testable without KV
// registerSite / getSites / deleteSite / validateSiteToken require real KV
// and are covered by integration tests against a real CF deployment

test('sites: generateToken returns 32-char hex string', async t => {
  const token = await generateToken()
  t.is(token.length, 32)
  t.ok(/^[0-9a-f]+$/.test(token))
})

test('sites: generateToken is unique each call', async t => {
  const a = await generateToken()
  const b = await generateToken()
  t.not(a, b)
})

test('sites: siteKey returns correct KV key', t => {
  t.is(siteKey('example.com'), 'site:example.com')
})

test('sites: siteKey handles subdomain', t => {
  t.is(siteKey('blog.example.com'), 'site:blog.example.com')
})
