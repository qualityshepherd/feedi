import { unit as test } from '../testpup.js'
import { buildNav } from '../../src/nav.js'

test('buildNav: separateFeeds true shows feeds link', t => {
  t.ok(buildNav({ separateFeeds: true }).showFeeds)
})

test('buildNav: separateFeeds false/missing hides feeds link', t => {
  t.falsy(buildNav({ separateFeeds: false }).showFeeds)
  t.falsy(buildNav({}).showFeeds)
})

test('buildNav: separatePods true shows pods link', t => {
  t.ok(buildNav({ separatePods: true }).showPods)
})

test('buildNav: separatePods false/missing hides pods link', t => {
  t.falsy(buildNav({ separatePods: false }).showPods)
  t.falsy(buildNav({}).showPods)
})
