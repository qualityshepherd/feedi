import { unit as test } from '../testpup.js'
import { dotClass, dotTitle, buildOpml } from '../../assets/src/feedsAdmin.js'

// dotClass
test('dotClass: null status returns grey', t => {
  t.is(dotClass(null), 'dot-grey')
})

test('dotClass: status with error returns red', t => {
  t.is(dotClass({ error: 'timeout' }), 'dot-red')
})

test('dotClass: status with no code returns red', t => {
  t.is(dotClass({ fetched: '2026-01-01' }), 'dot-red')
})

test('dotClass: status with code >= 400 returns red', t => {
  t.is(dotClass({ code: 404 }), 'dot-red')
  t.is(dotClass({ code: 500 }), 'dot-red')
})

test('dotClass: status 200 returns green', t => {
  t.is(dotClass({ code: 200 }), 'dot-green')
})

test('dotClass: status 301 returns yellow', t => {
  t.is(dotClass({ code: 301 }), 'dot-yellow')
})

// dotTitle
test('dotTitle: null status returns never fetched', t => {
  t.is(dotTitle(null), 'never fetched')
})

test('dotTitle: status with error returns the error string', t => {
  t.is(dotTitle({ error: 'connection refused' }), 'connection refused')
})

test('dotTitle: status with code shows HTTP code', t => {
  t.ok(dotTitle({ code: 200 }).includes('HTTP 200'))
})

test('dotTitle: status with fetched includes time ago', t => {
  const fetched = new Date(Date.now() - 90000).toISOString() // ~1.5m ago
  const title = dotTitle({ code: 200, fetched })
  t.ok(title.includes('HTTP 200'))
  t.ok(title.includes('ago'))
})

// buildOpml
test('buildOpml: produces valid XML envelope', t => {
  const xml = buildOpml([])
  t.ok(xml.startsWith('<?xml'))
  t.ok(xml.includes('<opml'))
  t.ok(xml.includes('</opml>'))
})

test('buildOpml: includes each feed URL as outline', t => {
  const feeds = [
    { url: 'https://example.com/feed.xml' },
    { url: 'https://other.org/rss' }
  ]
  const xml = buildOpml(feeds)
  t.ok(xml.includes('https://example.com/feed.xml'))
  t.ok(xml.includes('https://other.org/rss'))
})

test('buildOpml: empty feeds produces valid XML with no outlines', t => {
  const xml = buildOpml([])
  t.ok(!xml.includes('<outline'))
})
