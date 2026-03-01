import { unit as test } from '../testpup.js'
import { isBot, detectPodApp, countryFlag, groupHitsByDate } from '../../worker/analytics.js'

// ── isBot ─────────────────────────────────────────────────────

test('Analytics: isBot detects php probe', t => {
  t.ok(isBot('/wp-login.php'))
})

test('Analytics: isBot detects env probe', t => {
  t.ok(isBot('/.env'))
})

test('Analytics: isBot detects wp- probe', t => {
  t.ok(isBot('/wp-admin/setup'))
})

test('Analytics: isBot detects static extension', t => {
  t.ok(isBot('/assets/css/style.css'))
})

test('Analytics: isBot returns false for normal path', t => {
  t.falsy(isBot('/posts/my-post'))
})

test('Analytics: isBot returns false for root', t => {
  t.falsy(isBot('/'))
})

test('Analytics: isBot is case insensitive', t => {
  t.ok(isBot('/XMLRPC.PHP'))
})

// ── detectPodApp ──────────────────────────────────────────────

test('Analytics: detectPodApp detects Overcast', t => {
  t.is(detectPodApp('Overcast/3.1 (+http://overcast.fm/) Podcast/1.0'), 'Overcast')
})

test('Analytics: detectPodApp detects Pocket Casts', t => {
  t.is(detectPodApp('PocketCasts/7.0 iOS'), 'Pocket Casts')
})

test('Analytics: detectPodApp detects Spotify', t => {
  t.is(detectPodApp('Spotify/8.7 iOS/16.0'), 'Spotify')
})

test('Analytics: detectPodApp detects Apple Podcasts', t => {
  t.is(detectPodApp('AppleCoreMedia/1.0.0.20G75 (iPhone; U; CPU OS 16_6)'), 'Apple Podcasts')
})

test('Analytics: detectPodApp detects Castro', t => {
  t.is(detectPodApp('Castro/2023 CFNetwork/1408.0'), 'Castro')
})

test('Analytics: detectPodApp detects Downcast', t => {
  t.is(detectPodApp('Downcast/2.9.21 iOS/16.0'), 'Downcast')
})

test('Analytics: detectPodApp returns Other for unknown ua', t => {
  t.is(detectPodApp('Mozilla/5.0 SomeRandomApp'), 'Other')
})

test('Analytics: detectPodApp returns Other for empty ua', t => {
  t.is(detectPodApp(''), 'Other')
})

// ── countryFlag ───────────────────────────────────────────────

test('Analytics: countryFlag returns span with flag and title', t => {
  const result = countryFlag('US')
  t.ok(result.includes('title="US"'))
  t.ok(result.includes('<span'))
})

test('Analytics: countryFlag returns empty string for unknown', t => {
  t.is(countryFlag('?'), '')
})

// ── groupHitsByDate ───────────────────────────────────────────

test('Analytics: groupHitsByDate groups hits by date', t => {
  const hits = [
    { ts: new Date('2025-01-01T10:00:00Z').getTime(), path: '/a' },
    { ts: new Date('2025-01-01T20:00:00Z').getTime(), path: '/b' },
    { ts: new Date('2025-01-02T10:00:00Z').getTime(), path: '/c' }
  ]
  const result = groupHitsByDate(hits)
  t.is(result['2025-01-01'].length, 2)
  t.is(result['2025-01-02'].length, 1)
})

test('Analytics: groupHitsByDate returns empty object for no hits', t => {
  t.deepEqual(groupHitsByDate([]), {})
})
