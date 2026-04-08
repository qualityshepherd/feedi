import { renderTags } from './ui.js'
import { stripHtml, processContent, truncateContent } from './feedRules.js'

const CONTENT_LENGTH = 4200

const isPodcast = post => !!post.meta.audioUrl

const subscribeLink = post => {
  if (post.meta.page) return '' // no link on pages
  const href = isPodcast(post) ? '/rss/pod' : '/rss/blog'
  const title = isPodcast(post) ? 'Subscribe to podcast feed' : 'Subscribe to blog feed'
  return `<a class="rss-subscribe" href="${href}" title="${title}" target="_blank" rel="noopener noreferrer">◆ subscribe</a>`
}

export const postsTemplate = post => `
  <div class="post">
    <a href="/posts/${post.meta.slug}" role="button" aria-label="post-title">
      <h2 class="post-title">${post.meta.title}</h2>
    </a>
    ${post.meta.page ? '' : `<div class="date">${post.meta.date}</div>`}
    <div>${post.html}</div>
    ${post.meta.audioUrl ? `<audio controls src="${post.meta.audioUrl}" preload="metadata" style="width:100%;margin:0.5rem 0 1rem"></audio>` : ''}
    <div class="tags">${renderTags(post.meta.tags)} ${subscribeLink(post)}</div>
  </div>
`

export const singlePostTemplate = post => `
  <article class="post">
    <h2>${post.meta.title}</h2>
    ${post.meta.page ? '' : `<div class="date">${post.meta.date}</div>`}
    <div class="post-content">${post.html}</div>
    ${post.meta.audioUrl ? `<audio controls src="${post.meta.audioUrl}" preload="metadata" style="width:100%;margin:1rem 0"></audio>` : ''}
    <div class="tags">${renderTags(post.meta.tags)} ${subscribeLink(post)}</div>
  </article>
`

export const notFoundTemplate = (message = 'No results found.') => `
  <h2 class="not-found">${message}</h2>
`

export const archiveTemplate = post => `
  <p>
    <a href="/posts/${post.meta.slug}"><span class="archive">${post.meta.title}</span></a>
    <span class="date">${post.meta.date}</span>
  </p>
`

const formatDate = (dateStr) => {
  try {
    return new Date(dateStr).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return dateStr }
}

const feedDomain = (url) => {
  try { return new URL(url).hostname } catch { return '' }
}

const safeUrl = (url) => {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:' ? url : ''
  } catch { return '' }
}

export const feedsItemTemplate = (item) => {
  const url = safeUrl(item.url)
  const domain = feedDomain(url)
  const avatar = domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : ''
  const dateStr = formatDate(item.date)

  return `
  <div class="post feed-post">
    ${url
      ? `<a class="feed-meta" href="${url}" target="_blank" rel="noopener noreferrer">`
      : '<div class="feed-meta">'}
      ${avatar ? `<img class="feed-avatar" src="${avatar}" alt="">` : ''}
      <span>${item.author ? `${item.author} · ` : ''}${item.feed?.title || domain}</span>
      <span class="date">${dateStr}</span>
    ${url ? '</a>' : '</div>'}
    ${item.title
      ? `${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">` : ''}<h2 class="post-title">${stripHtml(item.title)}</h2>${url ? '</a>' : ''}`
      : ''}
    ${item.content ? `<div class="feed-content">${processContent(truncateContent(item.content, url, CONTENT_LENGTH), item.feed?.url)}</div>` : ''}
  </div>
  `
}
