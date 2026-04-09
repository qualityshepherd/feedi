import { elements } from './dom.js'
import { feedsItemTemplate, notFoundTemplate } from './templates.js'
import { getDisplayedPosts } from './state.js'
import { toggleLoadMoreButton } from './ui.js'

let cachedFeeds = null
let cachedDiscover = null

const readAggregated = async (path) => {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export const renderFeedsItems = (items) => {
  if (!items.length) {
    elements.main.innerHTML = notFoundTemplate('No feed posts found. Add feeds to feeds.json.')
    toggleLoadMoreButton(false)
    return
  }
  const limit = getDisplayedPosts()
  elements.main.innerHTML = items.slice(0, limit).map(feedsItemTemplate).join('')
  toggleLoadMoreButton(limit < items.length)
}

export const getCachedFeeds = () => cachedFeeds

export const loadAndRenderFeeds = async () => {
  try {
    if (!cachedFeeds) {
      cachedFeeds = await readAggregated('/feeds/aggregated')
    }
    renderFeedsItems(cachedFeeds)
  } catch (err) {
    console.error('Failed to load feeds:', err)
    elements.main.innerHTML = notFoundTemplate('Could not load feeds.')
  }
}

// Map discover post (index.json format) to feed item format for feedsItemTemplate
const toFeedItem = (post) => {
  const instanceUrl = post.meta.instanceUrl || ''
  const domain = (() => { try { return new URL(instanceUrl).hostname } catch { return instanceUrl } })()
  return {
    url: `${instanceUrl}/posts/${post.meta.slug}`,
    title: post.meta.title,
    content: post.html,
    date: post.meta.date,
    feed: { title: domain, url: instanceUrl }
  }
}

export const loadAndRenderDiscover = async () => {
  try {
    if (!cachedDiscover) {
      cachedDiscover = await readAggregated('/discover/feed')
    }
    const items = cachedDiscover.map(toFeedItem)
    if (!items.length) {
      elements.main.innerHTML = notFoundTemplate('No discover posts yet. Add a seed instance in admin.')
      toggleLoadMoreButton(false)
      return
    }
    const limit = getDisplayedPosts()
    elements.main.innerHTML = items.slice(0, limit).map(feedsItemTemplate).join('')
    toggleLoadMoreButton(limit < items.length)
  } catch (err) {
    console.error('Failed to load discover:', err)
    elements.main.innerHTML = notFoundTemplate('Could not load discover.')
  }
}

export const getCachedDiscover = () => cachedDiscover
