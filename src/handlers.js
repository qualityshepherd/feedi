/* global location, history */
import config from '../feedi.config.js'
import { elements } from './dom.js'
import {
  getPosts,
  getDisplayedPosts,
  setDisplayedPosts,
  setSearchTerm,
  incrementDisplayedPosts
} from './state.js'
import {
  renderAboutPage,
  renderArchive,
  renderFilteredPosts,
  renderNotFoundPage,
  renderPosts,
  renderSinglePost,
  toggleLoadMoreButton
} from './ui.js'
import { loadAndRenderFeeds } from './feeds.js'

const ROUTES = {
  HOME: '/',
  POST: '/posts',
  ABOUT: '/about',
  TAG: '/tag',
  ARCHIVE: '/archive',
  READER: '/feeds'
}

const getRouteParams = () => {
  const params = new URLSearchParams(location.search)
  return { route: location.pathname, params }
}

const normalize = str => String(str || '').toLowerCase()

const filterPostsByTag = (posts, tag) =>
  posts.filter(post =>
    post.meta.tags?.some(t => normalize(t) === normalize(tag))
  )

const routeHandlers = {
  [ROUTES.HOME]: async () => {
    if (getDisplayedPosts() === 0) {
      setDisplayedPosts(config.maxPosts)
    }
    if (!config.separateFeeds) {
      await loadAndRenderFeeds()
    } else {
      const posts = getPosts()
      const displayedCount = getDisplayedPosts()
      renderPosts(posts, displayedCount)
      toggleLoadMoreButton(displayedCount < posts.length)
    }
  },

  [ROUTES.POST]: () => {
    const slug = location.pathname.split('/')[2]
    if (slug) renderSinglePost(slug)
  },

  [ROUTES.ABOUT]: () => {
    renderAboutPage()
  },

  [ROUTES.TAG]: ({ params }) => {
    const tag = params.get('t')
    if (tag) {
      const posts = getPosts()
      const filtered = filterPostsByTag(posts, tag)
      renderPosts(filtered, filtered.length)
    }
  },

  [ROUTES.ARCHIVE]: () => {
    renderArchive(getPosts())
  },

  // /search is not a nav route — URL state set by handleSearch via replaceState.
  // Handler exists so shared/direct search URLs still work.
  '/search': ({ params }) => {
    const query = params.get('q')
    if (query) {
      setSearchTerm(query.toLowerCase())
      if (elements.searchInput) elements.searchInput.value = query
      renderFilteredPosts()
    } else {
      setSearchTerm('')
      const posts = getPosts()
      renderPosts(posts, posts.length)
    }
  },

  [ROUTES.READER]: async () => {
    if (config.separateFeeds) {
      setDisplayedPosts(config.maxFeedItems === 0 ? Infinity : (config.maxFeedItems || 20))
      await loadAndRenderFeeds()
    } else {
      renderNotFoundPage()
    }
  },

  default: () => {
    renderNotFoundPage()
  }
}

export function handleRouting () {
  const { route, params } = getRouteParams()
  setSearchTerm('')

  const resolvedRoute = route.startsWith('/posts/') ? ROUTES.POST : route
  const handler = routeHandlers[resolvedRoute] || routeHandlers.default
  handler({ params })
}

export function handleSearch (e) {
  const searchValue = e.target.value.toLowerCase()
  setSearchTerm(searchValue)

  if (searchValue) {
    history.replaceState(null, '', '/search?q=' + encodeURIComponent(e.target.value))
  } else {
    history.replaceState(null, '', '/')
  }

  renderFilteredPosts()
}

export function handleLoadMore () {
  incrementDisplayedPosts()
  const posts = getPosts()
  const displayedCount = getDisplayedPosts()
  renderPosts(posts, displayedCount)
  toggleLoadMoreButton(displayedCount < posts.length)
}

export function closeMenu () {
  if (elements.menuLinks) elements.menuLinks.style.display = 'none'
}

export function toggleMenu () {
  const links = elements.menuLinks
  if (!links) return
  links.style.display = links.style.display === 'block' ? 'none' : 'block'
}
