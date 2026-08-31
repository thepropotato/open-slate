import { z } from 'zod'
import { useAsyncValue } from '@/core/hooks'
import { faviconUrl, isExtension } from '@/core/platform/browser'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { hostLabel } from '@/features/search/providers'
import {
  ListEmpty,
  ListLoading,
  ListRow,
  PermissionGate,
} from '@/features/widgets/shared/ListShell'

// Recently closed tabs and windows. `chrome.sessions` restores them with their
// navigation history intact, which reopening the bare URL would not.

const ContinueConfig = z.object({
  limit: z.number().min(3).max(25).default(8),
  showWindows: z.boolean().default(true),
  showHost: z.boolean().default(true),
})

type ContinueConfig = z.infer<typeof ContinueConfig>

interface ClosedEntry {
  key: string
  title: string
  url: string
  sessionId?: string
  tabCount: number
}

function ContinueWidget({ config }: WidgetProps<ContinueConfig>) {
  return (
    <PermissionGate
      needs={['sessions']}
      reason="Reopening closed tabs needs access to your session list."
    >
      <ClosedList config={config} />
    </PermissionGate>
  )
}

function ClosedList({ config }: { config: ContinueConfig }) {
  const entries = useAsyncValue(`sessions:${config.limit}:${config.showWindows}`, () =>
    readRecentlyClosed(config.limit, config.showWindows),
  )

  if (!entries) return <ListLoading />
  if (entries.length === 0) return <ListEmpty>Nothing closed recently.</ListEmpty>

  return (
    <div className="blist scroll-y">
      {entries.map((entry) => (
        <ListRow
          key={entry.key}
          title={entry.title}
          subtitle={
            config.showHost
              ? entry.tabCount > 1
                ? `${entry.tabCount} tabs`
                : hostLabel(entry.url)
              : undefined
          }
          image={entry.tabCount > 1 ? undefined : faviconUrl(entry.url, 32)}
          icon={entry.tabCount > 1 ? 'window' : undefined}
          action="reset"
          onClick={() => void restore(entry)}
        />
      ))}
    </div>
  )
}

async function readRecentlyClosed(limit: number, includeWindows: boolean): Promise<ClosedEntry[]> {
  if (!isExtension() || !chrome.sessions?.getRecentlyClosed) return []
  try {
    const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: limit })
    const entries: ClosedEntry[] = []
    for (const session of sessions) {
      if (session.tab) {
        entries.push({
          key: session.tab.sessionId ?? `${session.lastModified}`,
          title: session.tab.title || session.tab.url || '',
          url: session.tab.url ?? '',
          sessionId: session.tab.sessionId,
          tabCount: 1,
        })
      } else if (session.window && includeWindows) {
        const tabs = session.window.tabs ?? []
        entries.push({
          key: session.window.sessionId ?? `${session.lastModified}`,
          title: tabs[0]?.title ? `${tabs[0].title} and ${tabs.length - 1} more` : 'Closed window',
          url: tabs[0]?.url ?? '',
          sessionId: session.window.sessionId,
          tabCount: tabs.length,
        })
      }
      if (entries.length >= limit) break
    }
    return entries
  } catch {
    return []
  }
}

async function restore(entry: ClosedEntry): Promise<void> {
  if (entry.sessionId && chrome.sessions?.restore) {
    await chrome.sessions.restore(entry.sessionId)
    return
  }
  if (entry.url) window.location.assign(entry.url)
}

registerWidget<ContinueConfig>({
  type: 'continue',
  name: 'Recently closed',
  description: 'Reopen a tab or window you just closed, with its history intact.',
  icon: 'history',
  configSchema: ContinueConfig,
  sizes: ['medium', 'large', 'xlarge'],
  defaultSize: 'large',
  permissions: ['sessions'],
  Component: ContinueWidget,
  fields: [
    { path: 'limit', label: 'How many', control: { kind: 'slider', min: 3, max: 25 } },
    { path: 'showWindows', label: 'Include closed windows', control: { kind: 'toggle' } },
    { path: 'showHost', label: 'Show the site', control: { kind: 'toggle' } },
  ],
})
