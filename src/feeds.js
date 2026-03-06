import { elements } from './dom.js'
import { feedsItemTemplate, notFoundTemplate } from './templates.js'
import { getDisplayedPosts } from './state.js'

let cachedFeeds = null

const readAggregated = async (path) => {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export const renderFeedsItems = (items) => {
  if (!items.length) {
    elements.main.innerHTML = notFoundTemplate('No feed posts found. Add feeds to feeds.json.')
    return
  }
  const limit = getDisplayedPosts()
  elements.main.innerHTML = items.slice(0, limit).map(feedsItemTemplate).join('')
}

export const loadAndRenderFeeds = async () => {
  try {
    if (!cachedFeeds) {
      cachedFeeds = await readAggregated('./feedIndex.json')
    }
    renderFeedsItems(cachedFeeds)
  } catch (err) {
    console.error('Failed to load feeds:', err)
    elements.main.innerHTML = notFoundTemplate('Could not load feeds.')
  }
}
