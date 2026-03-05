import { e2e as test } from '../testpup.js'
import { locators as $, feediPage } from './pages/feedi.page.js'

test('e2e: should use menu to navigate to about page', async t => {
  await feediPage(t).goto()
  await t.waitAndClick($.aboutLink)
  t.ok((await t.url()).includes('/about'))
  t.ok(await t.exists('h2'))
})

test('e2e: should access archive posts via url', async t => {
  await feediPage(t).goto('archive')
  t.ok(await t.count($.archiveLink) > 0)
})

test('e2e: should filter posts by tag', async t => {
  await feediPage(t).goto()
  await t.waitAndClick($.tagLink)
  t.ok((await t.url()).includes('/tag'))
  t.ok(await t.exists('.tags'))
})
