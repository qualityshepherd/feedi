import { unit as test } from '../testpup.js'
import { classifyHit, countryFlag, countryFlagWithRegion, isBot, isDatacenter, parseDevice, parseRssSubscribers } from '../../worker/analytics.js'

// isBot

test('Analytics: isBot detects php probe', t => { t.ok(isBot('/wp-login.php')) })
test('Analytics: isBot detects env probe', t => { t.ok(isBot('/.env')) })
test('Analytics: isBot detects wp- probe', t => { t.ok(isBot('/wp-admin/setup')) })
test('Analytics: isBot ignores static extension — classifyHit handles it', t => { t.falsy(isBot('/assets/css/style.css')) })
test('Analytics: isBot detects swagger probe', t => { t.ok(isBot('/swagger/swagger-ui.html')) })
test('Analytics: isBot detects statistics.json probe', t => { t.ok(isBot('/statistics.json')) })
test('Analytics: isBot detects actuator probe', t => { t.ok(isBot('/actuator/env')) })
test('Analytics: isBot detects graphql probe', t => { t.ok(isBot('/graphql')) })
test('Analytics: isBot returns false for normal path', t => { t.falsy(isBot('/posts/my-post')) })
test('Analytics: isBot returns false for root', t => { t.falsy(isBot('/')) })
test('Analytics: isBot is case insensitive', t => { t.ok(isBot('/XMLRPC.PHP')) })
test('Analytics: isBot allows real browser UA', t => { t.falsy(isBot('/', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')) })
test('Analytics: isBot detects .DS_Store anywhere in path', t => { t.ok(isBot('/posts/.DS_Store')) })
test('Analytics: isBot detects unrendered template literal in path', t => { t.ok(isBot('/src/$' + '{url}')) })
test('Analytics: isBot detects URL-encoded %24%7B template literal', t => { t.ok(isBot('/src/%24%7B')) })

// classifyHit

test('classifyHit: skips static extensions', t => { t.is(classifyHit('/assets/css/style.css'), 'skip') })
test('classifyHit: skips png', t => { t.is(classifyHit('/apple-touch-icon.png'), 'skip') })
test('classifyHit: skips mp3', t => { t.is(classifyHit('/pods/episode.mp3'), 'skip') })
test('classifyHit: skips /src paths', t => { t.is(classifyHit('/src/app.js'), 'skip') })
test('classifyHit: skips /api paths', t => { t.is(classifyHit('/api/posts'), 'skip') })
test('classifyHit: datacenter ASN on asset path is skipped not bot', t => { t.is(classifyHit('/logo.png', '', 15169), 'skip') })
test('classifyHit: normal post is a hit', t => { t.is(classifyHit('/posts/my-post'), 'hit') })
test('classifyHit: root is a hit', t => { t.is(classifyHit('/'), 'hit') })
test('classifyHit: .DS_Store is a bot', t => { t.is(classifyHit('/posts/.DS_Store'), 'bot') })
test('classifyHit: datacenter ASN returns bot', t => { t.is(classifyHit('/posts/hello', '', 15169), 'bot') })
test('classifyHit: bot path returns bot', t => { t.is(classifyHit('/wp-login.php', 'Mozilla/5.0'), 'bot') })

// isDatacenter

test('isDatacenter: known ASN returns true', t => { t.ok(isDatacenter(15169)) })
test('isDatacenter: unknown ASN returns false', t => { t.falsy(isDatacenter(1234)) })
test('isDatacenter: null returns false', t => { t.falsy(isDatacenter(null)) })

// countryFlag

test('Analytics: countryFlag returns span with flag and title', t => {
  const result = countryFlag('US')
  t.ok(result.includes('title="US"'))
  t.ok(result.includes('<span'))
})
test('Analytics: countryFlag returns empty string for unknown', t => { t.is(countryFlag('?'), '') })
test('Analytics: countryFlag returns empty string for null', t => { t.is(countryFlag(null), '') })

// countryFlagWithRegion

test('Analytics: countryFlagWithRegion includes region in title', t => {
  const result = countryFlagWithRegion('US', 'NY')
  t.ok(result.includes('NY, US'))
})
test('Analytics: countryFlagWithRegion falls back to code when region is ?', t => {
  const result = countryFlagWithRegion('US', '?')
  t.ok(result.includes('title="US"'))
})

// parseRssSubscribers

test('parseRssSubscribers: parses Feedbin UA', t => {
  const result = parseRssSubscribers('Feedbin feed-id:123 - 42 subscribers')
  t.is(result.aggregator, 'Feedbin')
  t.is(result.subscribers, 42)
})
test('parseRssSubscribers: parses NewsBlur UA', t => {
  const result = parseRssSubscribers('NewsBlur/8 subscribers')
  t.is(result.aggregator, 'NewsBlur')
  t.is(result.subscribers, 8)
})
test('parseRssSubscribers: parses Inoreader UA', t => {
  const result = parseRssSubscribers('Mozilla/5.0 (inoreader.com +15 subscribers)')
  t.is(result.aggregator, 'Inoreader')
  t.is(result.subscribers, 15)
})
test('parseRssSubscribers: returns null for unknown UA', t => { t.is(parseRssSubscribers('curl/7.0'), null) })
test('parseRssSubscribers: returns null for empty UA', t => {
  t.is(parseRssSubscribers(''), null)
  t.is(parseRssSubscribers(null), null)
})

// parseDevice

test('parseDevice: detects iPhone as mobile', t => {
  t.is(parseDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'mobile')
})
test('parseDevice: detects Android as mobile', t => {
  t.is(parseDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)'), 'mobile')
})
test('parseDevice: detects desktop Mac as desktop', t => {
  t.is(parseDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), 'desktop')
})
test('parseDevice: empty UA defaults to desktop', t => {
  t.is(parseDevice(''), 'desktop')
  t.is(parseDevice(null), 'desktop')
})
