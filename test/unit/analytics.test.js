import { unit as test } from '../testpup.js'
import { isBot, detectPodApp, countryFlag, backupKey, buildHit, freshDay } from '../../worker/analytics.js'

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

test('Analytics: isBot detects swagger probe', t => {
  t.ok(isBot('/swagger/swagger-ui.html'))
})

test('Analytics: isBot detects statistics.json probe', t => {
  t.ok(isBot('/statistics.json'))
})

test('Analytics: isBot detects actuator probe', t => {
  t.ok(isBot('/actuator/env'))
})

test('Analytics: isBot detects graphql probe', t => {
  t.ok(isBot('/graphql'))
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

test('Analytics: isBot detects python UA', t => {
  t.ok(isBot('/', 'python-requests/2.28.0'))
})

test('Analytics: isBot detects curl UA', t => {
  t.ok(isBot('/', 'curl/7.88.1'))
})

test('Analytics: isBot allows real browser UA', t => {
  t.falsy(isBot('/', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'))
})

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

test('Analytics: countryFlag returns span with flag and title', t => {
  const result = countryFlag('US')
  t.ok(result.includes('title="US"'))
  t.ok(result.includes('<span'))
})

test('Analytics: countryFlag returns empty string for unknown', t => {
  t.is(countryFlag('?'), '')
})

test('Backup: backupKey generates correct R2 path', t => {
  t.is(backupKey('2026-03-01'), 'feedi-backups/analytics-2026-03-01.json')
})

test('buildHit: has no region field', t => {
  const hit = buildHit('/post', { country: 'US', city: 'NYC', region: 'NY' }, 'abc123')
  t.ok(!('region' in hit))
})

test('buildHit: includes country and city', t => {
  const hit = buildHit('/post', { country: 'DE', city: 'Berlin' }, 'abc123')
  t.is(hit.country, 'DE')
  t.is(hit.city, 'Berlin')
})

test('buildHit: derives hour from ts', t => {
  const ts = new Date('2026-03-03T14:30:00Z').getTime()
  const hit = buildHit('/post', {}, 'abc', '', ts)
  t.is(hit.hour, 14)
})

test('buildHit: defaults country and city to ?', t => {
  const hit = buildHit('/post', {}, 'abc')
  t.is(hit.country, '?')
  t.is(hit.city, '?')
})

test('buildHit: includes path and ip', t => {
  const hit = buildHit('/posts/foo', { country: 'US' }, 'hashval')
  t.is(hit.path, '/posts/foo')
  t.is(hit.ip, 'hashval')
})

test('freshDay: returns correct shape', t => {
  const day = freshDay('2026-03-03')
  t.is(day.date, '2026-03-03')
  t.is(day.totalHits, 0)
  t.is(day.bots, 0)
  t.is(day.uniques, 0)
  t.deepEqual(day.byHour, Array(24).fill(0))
  t.ok('byPath' in day)
  t.ok('byCountry' in day)
  t.ok('byCity' in day)
  t.ok('byReferrer' in day)
  t.ok('rss' in day)
})

test('freshDay: no region in shape', t => {
  const day = freshDay('2026-03-03')
  t.ok(!('region' in day))
  t.ok(!('byRegion' in day))
})

test('freshDay: rss shape is correct', t => {
  const day = freshDay('2026-03-03')
  t.ok('blog' in day.rss)
  t.ok('pod' in day.rss)
  t.is(day.rss.blog.total, 0)
  t.deepEqual(day.rss.blog.byApp, {})
})
