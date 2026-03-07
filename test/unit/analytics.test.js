import { unit as test } from '../testpup.js'
import { applyHit, backupKey, buildHit, buildR2Backup, deserializeDay, detectPodApp, freshDay, isBot, serializeDay } from '../../worker/analytics.js'

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

test('Backup: backupKey generates correct R2 path', t => {
  t.is(backupKey('2026-03-01'), 'analytics/2026-03-01.json')
})

test('buildHit: has region field', t => {
  const hit = buildHit('/post', { country: 'US', city: 'NYC', region: 'NY' }, 'abc123')
  t.ok('region' in hit)
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

// applyHit
test('applyHit: increments totalHits', t => {
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), buildHit('/foo', { country: 'US', city: 'NYC' }, 'ip1'))
  t.is(day.totalHits, 1)
})
test('applyHit: counts bot separately', t => {
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), { bot: true })
  t.is(day.bots, 1)
  t.is(day.totalHits, 0)
})
test('applyHit: counts rss blog hit', t => {
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), { rss: 'blog', app: 'Overcast' })
  t.is(day.rss.blog.total, 1)
  t.is(day.rss.blog.byApp.Overcast, 1)
  t.is(day.totalHits, 0)
})
test('applyHit: counts rss pod hit', t => {
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), { rss: 'pod', app: 'Castro' })
  t.is(day.rss.pod.total, 1)
  t.is(day.rss.pod.byApp.Castro, 1)
})
test('applyHit: tracks unique ips', t => {
  const hit = buildHit('/foo', {}, 'ip1')
  const r1 = applyHit(freshDay('2026-03-03'), new Set(), hit)
  const r2 = applyHit(r1.day, r1.uniques, hit)
  t.is(r2.uniques.size, 1)
  t.is(r2.day.uniques, 1)
})
test('applyHit: does not mutate input day', t => {
  const day = freshDay('2026-03-03')
  applyHit(day, new Set(), buildHit('/foo', { country: 'US' }, 'ip1'))
  t.is(day.totalHits, 0)
})
test('applyHit: increments byPath', t => {
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), buildHit('/posts/hello', {}, 'ip1'))
  t.is(day.byPath['/posts/hello'], 1)
})
test('applyHit: increments byHour', t => {
  const ts = new Date('2026-03-03T09:00:00Z').getTime()
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), buildHit('/foo', {}, 'ip1', '', ts))
  t.is(day.byHour[9], 1)
})
test('applyHit: increments byDow', t => {
  const ts = new Date('2026-03-03T09:00:00Z').getTime() // Tuesday = 2
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), buildHit('/foo', {}, 'ip1', '', ts))
  t.is(day.byDow[2], 1)
})
test('applyHit: increments byCountry', t => {
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), buildHit('/foo', { country: 'JP' }, 'ip1'))
  t.is(day.byCountry.JP, 1)
})
test('applyHit: parses referrer hostname', t => {
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), buildHit('/foo', {}, 'ip1', 'https://news.ycombinator.com/item?id=123'))
  t.is(day.byReferrer['news.ycombinator.com'], 1)
})
test('applyHit: adds to recentHits ring buffer', t => {
  const hit = buildHit('/foo', { country: 'US', city: 'NYC' }, 'ip1')
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), hit)
  t.is(day.recentHits.length, 1)
  t.is(day.recentHits[0].path, '/foo')
})
test('applyHit: caps recentHits at 100', t => {
  let day = freshDay('2026-03-03')
  let uniques = new Set()
  for (let i = 0; i < 105; i++) {
    const r = applyHit(day, uniques, buildHit('/foo', {}, 'ip' + i))
    day = r.day; uniques = r.uniques
  }
  t.is(day.recentHits.length, 100)
})
test('applyHit: bots do not add to recentHits', t => {
  const { day } = applyHit(freshDay('2026-03-03'), new Set(), { bot: true })
  t.is(day.recentHits.length, 0)
})

// serializeDay / deserializeDay
test('serializeDay: stores uniques as array', t => {
  const out = serializeDay(freshDay('2026-03-03'), new Set(['ip1', 'ip2']))
  t.deepEqual(out._uniqueArr.sort(), ['ip1', 'ip2'])
  t.is(out.uniques, 2)
})
test('deserializeDay: restores Set from array', t => {
  const stored = serializeDay(freshDay('2026-03-03'), new Set(['ip1', 'ip2']))
  const { day, uniques } = deserializeDay(stored)
  t.ok(uniques instanceof Set)
  t.is(uniques.size, 2)
  t.ok(!('_uniqueArr' in day))
})
test('deserializeDay: handles missing _uniqueArr', t => {
  const { uniques } = deserializeDay(freshDay('2026-03-03'))
  t.ok(uniques instanceof Set)
  t.is(uniques.size, 0)
})

// buildR2Backup — the alarm uses this to save yesterday's data without hitting the
// _load() date guard that caused the data-loss bug.
test('buildR2Backup: returns null when nothing stored', t => {
  t.is(buildR2Backup(null), null)
  t.is(buildR2Backup(undefined), null)
})

test('buildR2Backup: uses stored date (yesterday) not today', t => {
  const yesterday = '2026-03-05'
  const stored = serializeDay(freshDay(yesterday), new Set(['ip1']))
  const backup = buildR2Backup(stored)
  t.is(backup.key, `analytics/${yesterday}.json`)
})

test('buildR2Backup: data contains the actual hits from stored day', t => {
  const day = freshDay('2026-03-05')
  const hit = buildHit('/posts/foo', { country: 'US', city: 'NYC' }, 'ip1')
  const { day: populated, uniques } = applyHit(day, new Set(), hit)
  const stored = serializeDay(populated, uniques)
  const backup = buildR2Backup(stored)
  const parsed = JSON.parse(backup.data)
  t.is(parsed.totalHits, 1)
  t.is(parsed.byPath['/posts/foo'], 1)
})

test('buildR2Backup: data includes uniques array (not Set, JSON-safe)', t => {
  const stored = serializeDay(freshDay('2026-03-05'), new Set(['ip1', 'ip2']))
  const backup = buildR2Backup(stored)
  const parsed = JSON.parse(backup.data)
  t.ok(Array.isArray(parsed.uniques))
  t.is(parsed.uniques.length, 2)
})

test('buildR2Backup: key is correct R2 path format', t => {
  const stored = serializeDay(freshDay('2026-01-15'), new Set())
  const backup = buildR2Backup(stored)
  t.is(backup.key, 'analytics/2026-01-15.json')
})

// Regression: alarm at midnight must save YESTERDAY not an empty freshDay.
// This simulates what _load() would return vs what buildR2Backup uses.
test('buildR2Backup regression: stored date differs from today — still saves stored data', t => {
  // This is the midnight scenario: stored is yesterday, todayStr() is today.
  const yesterday = '2026-03-05'
  const day = freshDay(yesterday)
  const hit = buildHit('/', { country: 'DE' }, 'abc')
  const { day: withHit, uniques } = applyHit(day, new Set(), hit)
  const stored = serializeDay(withHit, uniques)

  // buildR2Backup must use stored.date, not today
  const backup = buildR2Backup(stored)
  t.ok(backup !== null)
  t.ok(backup.key.includes(yesterday))
  const parsed = JSON.parse(backup.data)
  t.is(parsed.totalHits, 1) // not 0 (what an empty freshDay would give)
})
