import { unit as test } from '../testpup.js'
import { buildNav } from '../../src/nav.js'

test('buildNav: separateFeeds false hides feeds link', t => {
  const nav = buildNav({ separateFeeds: false })
  t.falsy(nav.showFeeds)
})

test('buildNav: separateFeeds true shows feeds link', t => {
  const nav = buildNav({ separateFeeds: true })
  t.ok(nav.showFeeds)
})

test('buildNav: undefined separateFeeds hides feeds link', t => {
  const nav = buildNav({})
  t.falsy(nav.showFeeds)
})

test('buildNav: returns object with showFeeds key', t => {
  const nav = buildNav({ separateFeeds: true })
  t.ok('showFeeds' in nav)
})
