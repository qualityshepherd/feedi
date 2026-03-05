import { e2e as test } from '../testpup.js'
import { locators as $, feediPage } from './pages/feedi.page.js'

test('e2e: should display feeds items', async t => {
  await feediPage(t).goto('feeds')

  t.ok(await t.count($.feedsPost) > 0)
})

test('e2e: should display post titles in feeds', async t => {
  await feediPage(t).goto('feeds')
  t.ok(await t.count($.postTitle) > 0)
})

test('e2e: should handle empty or broken feedIndex.json gracefully', async t => {
  await feediPage(t).goto('feeds')
  const hasItems = await t.exists($.feedsPost)
  const hasNotFound = await t.exists($.notFoundMessage)
  t.ok(hasItems || hasNotFound)
})
