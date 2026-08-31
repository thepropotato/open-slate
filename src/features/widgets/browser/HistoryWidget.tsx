import { useState } from 'react'
import { z } from 'zod'
import { useAsyncValue } from '@/core/hooks'
import { faviconUrl, isExtension, openUrl } from '@/core/platform/browser'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { hostLabel } from '@/features/search/providers'
import {
  ListEmpty,
  ListLoading,
  ListRow,
  ListSearch,
  PermissionGate,
} from '@/features/widgets/shared/ListShell'

// History search; a blank query lists the most recent visits.

const HistoryConfig = z.object({
  limit: z.number().min(5).max(40).default(12),
  /** How far back a blank query looks. */
  days: z.number().min(1).max(90).default(7),
  showTime: z.boolean().default(true),
})

type HistoryConfig = z.infer<typeof HistoryConfig>

function HistoryWidget({ config }: WidgetProps<HistoryConfig>) {
  return (
    <PermissionGate needs={['history']} reason="Searching history needs access to it.">
      <HistoryList config={config} />
    </PermissionGate>
  )
}

function HistoryList({ config }: { config: HistoryConfig }) {
  const [query, setQuery] = useState('')
  const items = useAsyncValue(`history:${query}:${config.limit}:${config.days}`, () =>
    search(query, config.limit, config.days),
  )

  return (
    <div className="blist">
      <ListSearch value={query} onChange={setQuery} placeholder="Search history" />

      {!items ? (
        <ListLoading />
      ) : items.length === 0 ? (
        <ListEmpty>{query ? 'Nothing matches that.' : 'No recent history.'}</ListEmpty>
      ) : (
        <div className="blist__scroll scroll-y">
          {items.map((item) => (
            <ListRow
              key={item.id}
              title={item.title || hostLabel(item.url ?? '')}
              subtitle={
                config.showTime && item.lastVisitTime
                  ? `${hostLabel(item.url ?? '')} · ${relativeTime(item.lastVisitTime)}`
                  : hostLabel(item.url ?? '')
              }
              image={faviconUrl(item.url ?? '', 32)}
              onClick={() => openUrl(item.url ?? '')}
            />
          ))}
        </div>
      )}
    </div>
  )
}

async function search(
  query: string,
  limit: number,
  days: number,
): Promise<chrome.history.HistoryItem[]> {
  if (!isExtension() || !chrome.history?.search) return []
  try {
    const results = await chrome.history.search({
      text: query,
      maxResults: limit,
      startTime: Date.now() - days * 86_400_000,
    })
    return results.filter((item) => item.url)
  } catch {
    return []
  }
}

function relativeTime(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} d ago`
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(timestamp)
}

registerWidget<HistoryConfig>({
  type: 'history',
  name: 'History',
  description: 'Find a page you had open earlier.',
  icon: 'history',
  configSchema: HistoryConfig,
  sizes: ['medium', 'large', 'xlarge'],
  defaultSize: 'large',
  permissions: ['history'],
  Component: HistoryWidget,
  fields: [
    { path: 'limit', label: 'How many', control: { kind: 'slider', min: 5, max: 40 } },
    {
      path: 'days',
      label: 'Look back',
      control: { kind: 'slider', min: 1, max: 90, format: (v) => `${v} ${v === 1 ? 'day' : 'days'}` },
    },
    { path: 'showTime', label: 'Show when', control: { kind: 'toggle' } },
  ],
})
