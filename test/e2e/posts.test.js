import { e2e as test } from '../testpup.js'
import { locators as $, feediPage } from './pages/feedi.page.js'

import { readSiteIndex } from '../../src/state.js'

test('e2e: should display all posts', async t => {
  await feediPage(t).goto()
  t.ok(await t.count($.postTitle) > 0)
})

test('e2e: should load more posts', async t => {
  await feediPage(t).goto()
  const hasButton = await t.isVisible($.loadMoreButton)
  if (!hasButton) return // no load more button means all posts already shown
  const initialPostCount = await t.count($.postTitle)
  await t.waitAndClick($.loadMoreButton)
  t.falsy(await t.hasClass($.loadMoreButton, 'show'))
  t.ok(await t.count($.postTitle) > initialPostCount)
})

test('e2e: should display a single post', async t => {
  await feediPage(t).goto()
  await t.waitAndClick($.singlePostLink)
  t.ok((await t.url()).includes('/posts/'))
  t.is(await t.count('.post'), 1)
})

test('e2e: should be responsive; handle different viewports', async t => {
  await feediPage(t).goto()
  await t.page.setViewport({ height: 667, width: 375 })
  t.ok(await t.count($.postTitle) > 0)
  t.deepEqual(t.page.viewport(), { height: 667, width: 375 })
})

const BASE = process.env.TEST_ENV || 'http://localhost:4242'

test('readSiteIndex: returns posts with titles from live server', async t => {
  const data = await readSiteIndex(`${BASE}/index.json`)
  t.ok(data.length > 0)
  t.ok(data[0].meta.title)
})

test('readSiteIndex: excludes future-dated posts', async t => {
  const data = await readSiteIndex(`${BASE}/index.json`)
  t.ok(data.every(p => new Date(p.meta.date) <= new Date()))
})
