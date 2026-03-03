/* global location, history */
import { readSiteIndex, setPosts, setDisplayedPosts } from './state.js'
import { elements } from './dom.js'
import { handleLoadMore, handleRouting, handleSearch, toggleMenu, closeMenu } from './handlers.js'
import { buildNav } from './nav.js'
import config from '../feedi.config.js'

function applyNav () {
  const nav = buildNav(config)
  if (!nav.showFeeds) {
    document.getElementById('feeds-nav-link')?.remove()
  }
}

function setEventListeners () {
  elements.menu.addEventListener('click', toggleMenu)
  elements.searchInput.addEventListener('input', handleSearch)
  elements.loadMore?.addEventListener('click', handleLoadMore)
  window.addEventListener('popstate', handleRouting)

  // ESC closes menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu()
  })

  // click outside menu closes it
  document.addEventListener('click', (e) => {
    if (!elements.menu?.contains(e.target) && !elements.menuLinks?.contains(e.target)) {
      closeMenu()
    }
  })

  // intercept internal link clicks for pushState SPA navigation
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a')
    if (!a || !a.href || a.target === '_blank') return
    const url = new URL(a.href)
    if (url.origin !== location.origin) return
    e.preventDefault()
    history.pushState(null, '', url.pathname + url.search)
    handleRouting()
  })

  // prevents form submission on Enter key
  elements.searchForm?.addEventListener('submit', (e) => {
    e.preventDefault()
  })
}

;(async () => {
  const index = await readSiteIndex('/index.json')
  setPosts(index)
  setDisplayedPosts(config.maxPosts)
  applyNav()
  setEventListeners()
  handleRouting()
})()
