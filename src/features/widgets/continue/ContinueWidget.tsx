import { z } from 'zod'
import { Icon } from '@/core/icons'
import { useAsyncValue } from '@/core/hooks'
import { Button } from '@/core/ui'
import { faviconUrl, isExtension, permissions } from '@/core/platform/browser'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { hostLabel } from '@/features/search/providers'
import './continue.css'

/**
 * Recently closed tabs and windows.
 *
 * This is the entry that earns its place on a new tab page most often: the tab
 * you just closed by accident is exactly what you want back. `chrome.sessions`
 * restores it with its history intact, which reopening the URL would not.
 */

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
  const granted = useAsyncValue('sessions-permission', () => permissions.has(['sessions']))
  const entries = useAsyncValue(
    granted ? `sessions:${config.limit}:${config.showWindows}` : null,
    () => readRecentlyClosed(config.limit, config.showWindows),
  )

  if (granted === false) {
    return (
      <div className="cont cont--empty">
        <p>Reopening closed tabs needs access to your session list.</p>
        <Button
          icon="check"
          onClick={() => void permissions.request(['sessions']).then(() => window.location.reload())}
        >
          Allow
        </Button>
      </div>
    )
  }

  if (!entries) {
    return (
      <div className="cont cont--empty">
        <Icon name="spinner" spin />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="cont cont--empty">
        <p>Nothing closed recently.</p>
      </div>
    )
  }

  return (
    <ul className="cont scroll-y">
      {entries.map((entry) => (
        <li key={entry.key}>
          <button
            type="button"
            className="cont__item"
            onClick={() => void restore(entry)}
            title={entry.url || entry.title}
          >
            <span className="cont__icon">
              {entry.tabCount > 1 ? (
                <Icon name="window" />
              ) : (
                <img src={faviconUrl(entry.url, 32)} alt="" width={16} height={16} />
              )}
            </span>
            <span className="cont__text">
              <span className="cont__title">{entry.title}</span>
              {config.showHost ? (
                <span className="cont__sub">
                  {entry.tabCount > 1 ? `${entry.tabCount} tabs` : hostLabel(entry.url)}
                </span>
              ) : null}
            </span>
            <Icon name="reset" className="cont__action" />
          </button>
        </li>
      ))}
    </ul>
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
  defaultSize: { w: 7, h: 5 },
  minSize: { w: 4, h: 3 },
  permissions: ['sessions'],
  Component: ContinueWidget,
  fields: [
    {
      path: 'limit',
      label: 'How many',
      control: { kind: 'slider', min: 3, max: 25 },
    },
    { path: 'showWindows', label: 'Include closed windows', control: { kind: 'toggle' } },
    { path: 'showHost', label: 'Show the site', control: { kind: 'toggle' } },
  ],
})
