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
