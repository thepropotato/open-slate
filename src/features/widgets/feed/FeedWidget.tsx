import { useState } from 'react'
import { z } from 'zod'
import { Icon } from '@/core/icons'
import { useAsyncValue } from '@/core/hooks'
import { Button, TextInput } from '@/core/ui'
import { faviconUrl, openUrl } from '@/core/platform/browser'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { hostLabel } from '@/features/search/providers'
import { ListEmpty, ListLoading, ListRow } from '@/features/widgets/shared/ListShell'
import { loadFeeds, originOf, requestFeedAccess } from './api'
import { FeedList } from './FeedList'
import './feed.css'

// Feed reader. Host access is granted per feed origin when the feed is added,
// never blanket network permission.

const FeedConfig = z.object({
  urls: z.array(z.string()).default([]),
  limit: z.number().min(3).max(40).default(10),
  showSource: z.boolean().default(true),
  showTime: z.boolean().default(true),
  openInNewTab: z.boolean().default(false),
})

type FeedConfig = z.infer<typeof FeedConfig>

function FeedWidget({ config, setConfig }: WidgetProps<FeedConfig>) {
  const [draft, setDraft] = useState('')
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')

  const feeds = useAsyncValue(
    config.urls.length > 0 ? `feeds:${config.urls.join(',')}:${revision}` : null,
    () => loadFeeds(config.urls),
  )

  const add = async () => {
    const url = normalise(draft)
    if (!url) {
      setError('That does not look like a feed address.')
      return
    }
    if (config.urls.includes(url)) {
      setError('That feed is already here.')
      return
    }
    if (!(await requestFeedAccess(url))) {
      setError(`Reading ${hostLabel(url)} needs permission for that site.`)
      return
    }
    setError('')
    setDraft('')
    setConfig({ urls: [...config.urls, url] })
  }

  if (config.urls.length === 0) {
    return (
      <div className="feed feed--setup">
        <p>Add a feed address to follow a site here.</p>
        <div className="feed__addrow">
          <TextInput
            value={draft}
            onChange={setDraft}
            placeholder="https://example.com/feed.xml"
            wide
            type="url"
          />
          <Button icon="add" onClick={() => void add()} title="Add this feed" />
        </div>
        {error ? (
          <p className="feed__error">
            <Icon name="warning" /> {error}
          </p>
        ) : null}
      </div>
    )
  }

  if (!feeds) return <ListLoading />

  const needsPermission = feeds.filter((feed) => feed.error === 'needs-permission')
  const entries = feeds
    .flatMap((feed) => feed.items.map((item) => ({ ...item, source: feed.title, url: feed.url })))
    .sort((a, b) => b.published - a.published)
    .slice(0, config.limit)

  return (
    <div className="feed">
      {needsPermission.length > 0 ? (
        <div className="feed__grant">
          <Icon name="warning" />
          <span>{needsPermission.map((feed) => hostLabel(feed.url)).join(', ')} needs permission.</span>
          <Button
            onClick={() =>
              void Promise.all(needsPermission.map((feed) => requestFeedAccess(feed.url))).then(() =>
                setRevision((n) => n + 1),
              )
            }
          >
            Allow
          </Button>
        </div>
      ) : null}

      {entries.length === 0 ? (
        <ListEmpty>Nothing in these feeds yet.</ListEmpty>
      ) : (
        <div className="blist__scroll scroll-y">
          {entries.map((item) => (
            <ListRow
              key={item.id}
              title={item.title}
              subtitle={[
                config.showSource ? item.source || hostLabel(item.url) : '',
                config.showTime && item.published ? relative(item.published) : '',
              ]
                .filter(Boolean)
                .join(' · ')}
              image={faviconUrl(item.link || item.url, 32)}
              onClick={() =>
                item.link && openUrl(item.link, config.openInNewTab ? 'newTab' : 'current')
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Accepts a bare host and assumes https, like the tile editor.
function normalise(input: string): string {
  const value = input.trim()
  if (!value) return ''
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`
  return originOf(withScheme) ? withScheme : ''
}

function relative(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 8) return `${days} d ago`
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(timestamp)
}

registerWidget<FeedConfig>({
  type: 'feed',
  name: 'Feeds',
  description: 'Headlines from the RSS or Atom feeds you follow.',
  icon: 'feed',
  configSchema: FeedConfig,
  sizes: ['medium', 'large', 'xlarge'],
  defaultSize: 'large',
  Component: FeedWidget,
  fields: [
    {
      label: 'Feeds',
      help: 'Each feed asks for access to its own site when you add it.',
      control: { kind: 'custom', render: (scope) => <FeedList scope={scope} />, stacked: true },
      keywords: 'rss atom subscribe',
    },
    { path: 'limit', label: 'How many headlines', control: { kind: 'slider', min: 3, max: 40 } },
    { path: 'showSource', label: 'Show the source', control: { kind: 'toggle' } },
    { path: 'showTime', label: 'Show when', control: { kind: 'toggle' } },
    { path: 'openInNewTab', label: 'Open in a new tab', control: { kind: 'toggle' } },
  ],
})
