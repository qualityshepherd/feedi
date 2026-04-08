import { unit as test } from '../testpup.js'
import { aggregatePosts, extractTags, dedupInstances, isValidDiscoverUrl, normalizeTag } from '../../worker/discover.js'

// isValidDiscoverUrl
test('isValidDiscoverUrl: accepts https url', t => {
  t.ok(isValidDiscoverUrl('https://feedi.brine.dev'))
})

test('isValidDiscoverUrl: rejects http', t => {
  t.falsy(isValidDiscoverUrl('http://feedi.brine.dev'))
})

test('isValidDiscoverUrl: rejects non-url strings', t => {
  t.falsy(isValidDiscoverUrl('not-a-url'))
  t.falsy(isValidDiscoverUrl(''))
  t.falsy(isValidDiscoverUrl(null))
})

test('isValidDiscoverUrl: rejects localhost', t => {
  t.falsy(isValidDiscoverUrl('https://localhost'))
  t.falsy(isValidDiscoverUrl('https://localhost:8787'))
})

test('isValidDiscoverUrl: rejects private ip ranges', t => {
  t.falsy(isValidDiscoverUrl('https://192.168.1.1'))
  t.falsy(isValidDiscoverUrl('https://10.0.0.1'))
  t.falsy(isValidDiscoverUrl('https://127.0.0.1'))
})

test('isValidDiscoverUrl: strips trailing slash for storage', t => {
  t.is(isValidDiscoverUrl('https://feedi.brine.dev/'), 'https://feedi.brine.dev')
})

// normalizeTag
test('normalizeTag: lowercases tag', t => {
  t.is(normalizeTag('Music'), 'music')
})

test('normalizeTag: strips leading hash', t => {
  t.is(normalizeTag('#tech'), 'tech')
})

test('normalizeTag: trims whitespace', t => {
  t.is(normalizeTag('  web  '), 'web')
})

test('normalizeTag: handles already normal tag', t => {
  t.is(normalizeTag('code'), 'code')
})

// dedupInstances
test('dedupInstances: removes duplicate urls', t => {
  const instances = [
    { url: 'https://a.dev', title: 'A' },
    { url: 'https://b.dev', title: 'B' },
    { url: 'https://a.dev', title: 'A again' }
  ]
  t.is(dedupInstances(instances).length, 2)
})

test('dedupInstances: keeps first occurrence', t => {
  const instances = [
    { url: 'https://a.dev', title: 'First' },
    { url: 'https://a.dev', title: 'Second' }
  ]
  t.is(dedupInstances(instances)[0].title, 'First')
})

test('dedupInstances: empty array returns empty array', t => {
  t.deepEqual(dedupInstances([]), [])
})

// aggregatePosts
const makeResult = (instanceUrl, posts = []) => ({ instanceUrl, posts })

const makePost = (overrides = {}) => ({
  meta: {
    slug: 'test',
    title: 'Test Post',
    date: '2026-01-01',
    tags: ['a'],
    author: 'brine',
    ...overrides
  },
  html: '<p>content</p>'
})

test('aggregatePosts: tags posts with instanceUrl', t => {
  const results = [makeResult('https://a.dev', [makePost()])]
  const posts = aggregatePosts(results)
  t.is(posts[0].meta.instanceUrl, 'https://a.dev')
})

test('aggregatePosts: merges posts from multiple instances', t => {
  const results = [
    makeResult('https://a.dev', [makePost({ slug: 'a' })]),
    makeResult('https://b.dev', [makePost({ slug: 'b' })])
  ]
  t.is(aggregatePosts(results).length, 2)
})

test('aggregatePosts: sorts by date descending', t => {
  const results = [
    makeResult('https://a.dev', [makePost({ slug: 'old', date: '2025-01-01' })]),
    makeResult('https://b.dev', [makePost({ slug: 'new', date: '2026-06-01' })])
  ]
  const posts = aggregatePosts(results)
  t.is(posts[0].meta.slug, 'new')
  t.is(posts[1].meta.slug, 'old')
})

test('aggregatePosts: skips failed instances (null result)', t => {
  const results = [
    null,
    makeResult('https://b.dev', [makePost()])
  ]
  t.is(aggregatePosts(results).length, 1)
})

test('aggregatePosts: handles instance with empty posts', t => {
  const results = [makeResult('https://a.dev', [])]
  t.is(aggregatePosts(results).length, 0)
})

test('aggregatePosts: caps posts per instance at maxPerInstance', t => {
  const posts = Array.from({ length: 10 }, (_, i) => makePost({ slug: `post-${i}` }))
  const results = [makeResult('https://a.dev', posts)]
  t.is(aggregatePosts(results, { maxPerInstance: 3 }).length, 3)
})

test('aggregatePosts: default cap is 50 posts per instance', t => {
  const posts = Array.from({ length: 60 }, (_, i) => makePost({ slug: `post-${i}` }))
  const results = [makeResult('https://a.dev', posts)]
  t.is(aggregatePosts(results).length, 50)
})

// extractTags
test('extractTags: counts tags across posts', t => {
  const posts = [
    { meta: { tags: ['js', 'web'] } },
    { meta: { tags: ['js', 'music'] } }
  ]
  const tags = extractTags(posts)
  const js = tags.find(t => t.tag === 'js')
  t.is(js.count, 2)
})

test('extractTags: sorts by count descending', t => {
  const posts = [
    { meta: { tags: ['a', 'b', 'b'] } },
    { meta: { tags: ['b'] } }
  ]
  const tags = extractTags(posts)
  t.is(tags[0].tag, 'b')
})

test('extractTags: normalizes tags (lowercase, strips #)', t => {
  const posts = [
    { meta: { tags: ['Tech', '#tech', 'TECH'] } }
  ]
  const tags = extractTags(posts)
  t.is(tags.length, 1)
  t.is(tags[0].tag, 'tech')
  t.is(tags[0].count, 3)
})

test('extractTags: handles missing tags gracefully', t => {
  const posts = [{ meta: {} }, { meta: { tags: ['a'] } }]
  t.is(extractTags(posts).length, 1)
})

test('extractTags: returns empty array for no posts', t => {
  t.deepEqual(extractTags([]), [])
})
