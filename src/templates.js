import { renderTags } from './ui.js'

export const postsTemplate = post => `
  <div class="post">
    <a href="/posts/${post.meta.slug}" role="button" aria-label="post-title">
      <h2 class="post-title">${post.meta.title}</h2>
    </a>
    <div class="date">${post.meta.date}</div>
    <div>${post.html}</div>
    <div class="tags">${renderTags(post.meta.tags)}</div>
  </div>
`

export const singlePostTemplate = post => `
  <article class="post">
    <h2>${post.meta.title}</h2>
    <div class="date">${post.meta.date}</div>
    <div class="post-content">${post.html}</div>
    <div class="tags">${renderTags(post.meta.tags)}</div>
  </article>
`

export const notFoundTemplate = (message = 'No results found.') => `
  <h2 class="not-found">${message}</h2>
`

export const aboutPageTemplate = () => `
  <div class="post">
    <h2>About</h2>
    <p>Edit this in <code>src/templates.js</code></p>
  </div>
`

export const archiveTemplate = post => `
  <p>
    <a href="/posts/${post.meta.slug}"><span class="archive">${post.meta.title}</span></a>
    <span class="date">${post.meta.date}</span>
  </p>
`

const stripHtml = str => str.replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, c => {
  const entities = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&#32;': ' ' }
  return entities[c] || ' '
})

const excerpt = (content, len = 150) => {
  if (!content) return ''
  const text = stripHtml(content).replace(/\s+/g, ' ').trim()
  return text.length <= len ? text : text.slice(0, len).replace(/\s+\S*$/, '') + '...'
}

const formatDate = (dateStr) => {
  try {
    return new Date(dateStr).toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return dateStr }
}

export const feedsItemTemplate = item => `
  <div class="feeds-item">
    <a href="${item.url}" class="feeds-title" target="_blank" rel="noopener noreferrer">
      <h2 class="post-title">${stripHtml(item.title)}</h2>
    </a>
    ${item.content ? `<p class="feeds-excerpt">${excerpt(item.content)}</p>` : ''}
    <div class="feeds-meta">
      <span class="feeds-feed">${item.author ? `${item.author} · ` : ''}${item.feed?.title || ''}</span>
      <span class="date">${formatDate(item.date)}</span>
    </div>
  </div>
`
