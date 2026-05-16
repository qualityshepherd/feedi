import { unit as test } from '../testpup.js'
import { archiveTemplate } from '../../assets/src/templates.js'

const makePost = (overrides = {}) => ({
  meta: { slug: 'test-post', title: 'Test Post', date: '2026-01-01', tags: [], ...overrides }
})

// archiveTemplate isOwner
test('archiveTemplate: no edit button for guests', t => {
  const html = archiveTemplate(makePost())
  t.ok(!html.includes('post-edit-btn'))
})

test('archiveTemplate: edit button shown for owner', t => {
  const html = archiveTemplate(makePost(), true)
  t.ok(html.includes('post-edit-btn'))
})

test('archiveTemplate: includes post title', t => {
  const html = archiveTemplate(makePost({ title: 'My Great Post' }))
  t.ok(html.includes('My Great Post'))
})

test('archiveTemplate: links to post slug', t => {
  const html = archiveTemplate(makePost({ slug: 'my-great-post' }))
  t.ok(html.includes('/posts/my-great-post'))
})

test('archiveTemplate: includes data-slug attribute', t => {
  const html = archiveTemplate(makePost({ slug: 'my-great-post' }))
  t.ok(html.includes('data-slug="my-great-post"'))
})

test('archiveTemplate: podcast post has archive-pod class', t => {
  const html = archiveTemplate(makePost({ audioUrl: 'https://example.com/ep.mp3' }))
  t.ok(html.includes('archive-pod'))
})

test('archiveTemplate: regular post has no archive-pod class', t => {
  const html = archiveTemplate(makePost())
  t.ok(!html.includes('archive-pod'))
})
