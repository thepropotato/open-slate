/**
 * RSS and Atom parsing.
 *
 * Uses the platform's own `DOMParser` rather than a library: the two formats
 * differ in a handful of element names, and a feed parser is not where an
 * extension should spend bundle weight. `text/xml` parsing does not execute
 * anything, and every field is read as text, never as markup.
 */

export interface FeedItem {
  id: string
  title: string
  link: string
  published: number
  summary: string
}

export interface Feed {
  title: string
  items: FeedItem[]
}

export function parseFeed(xml: string): Feed | null {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) return null

  const channel = doc.querySelector('channel')
  if (channel) return parseRss(channel)

  const atom = doc.querySelector('feed')
  if (atom) return parseAtom(atom)

  return null
}

function parseRss(channel: Element): Feed {
  const items = [...channel.querySelectorAll('item')].map((item, index) => {
    const link = text(item, 'link')
    return {
      id: text(item, 'guid') || link || `${index}`,
      title: text(item, 'title') || '(untitled)',
      link,
      published: date(text(item, 'pubDate')),
      summary: strip(text(item, 'description')),
    }
  })
  return { title: text(channel, 'title'), items }
}

function parseAtom(feed: Element): Feed {
  const entries = [...feed.querySelectorAll('entry')].map((entry, index) => {
    // Atom puts the URL in an attribute, and may list several relations.
    const links = [...entry.querySelectorAll('link')]
    const alternate = links.find((l) => (l.getAttribute('rel') ?? 'alternate') === 'alternate')
    const link = alternate?.getAttribute('href') ?? links[0]?.getAttribute('href') ?? ''
    return {
      id: text(entry, 'id') || link || `${index}`,
      title: text(entry, 'title') || '(untitled)',
      link,
      published: date(text(entry, 'updated') || text(entry, 'published')),
      summary: strip(text(entry, 'summary') || text(entry, 'content')),
    }
  })
  // `feed > title` would also match an entry's title without the child selector.
  const title = [...feed.children].find((child) => child.tagName === 'title')?.textContent ?? ''
  return { title: title.trim(), items: entries }
}

const text = (parent: Element, tag: string): string =>
  parent.querySelector(tag)?.textContent?.trim() ?? ''

const date = (value: string): number => {
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Feed summaries are usually HTML. Rendering them is out of the question, so the
 * tags are dropped and the entities decoded through a detached document — which
 * never executes anything, unlike assigning to innerHTML on a live node.
 */
function strip(html: string): string {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 400)
}
