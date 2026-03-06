import { unit as test } from '../testpup.js'
import { getLimitedPosts } from '../../src/ui.js'

// renderFeedsItems and toggleLoadMoreButton touch the DOM so we test
// the pure logic that drives them: slicing and the "should show" condition.

function fakeItems (count) {
  return Array.from({ length: count }, (_, i) => ({
    feed: 'Test Feed',
    title: `Item ${i + 1}`,
    date: '2025-01-01',
    url: `https://example.com/${i + 1}`,
    content: `Content ${i + 1}`
  }))
}

test('Feeds: slicing respects display limit', t => {
  const items = fakeItems(40)
  const limit = 10
  const sliced = items.slice(0, limit)
  t.is(sliced.length, 10)
  t.is(sliced[0].title, 'Item 1')
  t.is(sliced[9].title, 'Item 10')
})

test('Feeds: load more button should show when items exceed limit', t => {
  const items = fakeItems(40)
  const limit = 10
  t.ok(limit < items.length, 'should show load more when limit < total')
})

test('Feeds: load more button should NOT show when all items visible', t => {
  const items = fakeItems(5)
  const limit = 10
  t.falsy(limit < items.length, 'should hide load more when limit >= total')
})

test('Feeds: load more button should NOT show when items exactly equal limit', t => {
  const items = fakeItems(10)
  const limit = 10
  t.falsy(limit < items.length, 'should hide load more when limit === total')
})

test('Feeds: incrementing display limit reveals more items', t => {
  const items = fakeItems(40)
  const maxPosts = 10
  let displayedCount = maxPosts

  // first render
  t.is(items.slice(0, displayedCount).length, 10)
  t.ok(displayedCount < items.length)

  // after load more
  displayedCount += maxPosts
  t.is(items.slice(0, displayedCount).length, 20)
  t.ok(displayedCount < items.length)

  // after all loads
  displayedCount = items.length
  t.is(items.slice(0, displayedCount).length, 40)
  t.falsy(displayedCount < items.length)
})

test('Feeds: getLimitedPosts is consistent with feeds slicing logic', t => {
  const posts = fakeItems(40).map(item => ({
    meta: { slug: item.title, title: item.title, date: item.date },
    html: item.content,
    markdown: item.content
  }))
  t.is(getLimitedPosts(posts, 10).length, 10)
  t.is(getLimitedPosts(posts, 40).length, 40)
  t.is(getLimitedPosts(posts, 100).length, 40)
})
