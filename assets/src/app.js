import { readSiteIndex, setPosts, setDisplayedPosts } from './state.js'
import { elements } from './dom.js'
import { handleLoadMore, handleRouting, handleSearch } from './handlers.js'

function setEventListeners () {
  elements.searchInput?.addEventListener('input', handleSearch)
  elements.loadMore?.addEventListener('click', handleLoadMore)

  window.addEventListener('popstate', handleRouting)

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a')
    if (!a || !a.href) return
    if (a.hasAttribute('download') || a.hash || e.metaKey || e.ctrlKey || a.target === '_blank') return

    const url = new URL(a.href)
    if (url.origin !== location.origin) {
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      return
    }

    e.preventDefault()
    history.pushState(null, '', url.pathname + url.search)
    handleRouting()
  })

  elements.searchForm?.addEventListener('submit', (e) => {
    e.preventDefault()
  })
}

;(async () => {
  const index = await readSiteIndex('/index.json')
  setPosts(index)
  setDisplayedPosts(10)
  setEventListeners()
  handleRouting()
})()
