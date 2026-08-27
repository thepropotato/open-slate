import { useState } from 'react'
import { z } from 'zod'
import { Icon } from '@/core/icons'
import { useAsyncValue } from '@/core/hooks'
import { faviconUrl, isExtension } from '@/core/platform/browser'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { hostLabel } from '@/features/search/providers'
import {
  ListEmpty,
  ListHeader,
  ListLoading,
  ListRow,
  ListSearch,
  PermissionGate,
} from '@/features/widgets/shared/ListShell'

/**
 * An overview of what is actually open.
 *
 * The duplicate finder is the part that pays for itself: after a long session
 * the same page is usually open three times, and closing the extras is a single
 * click here rather than a hunt across windows.
 */

const TabsConfig = z.object({
  limit: z.number().min(5).max(60).default(14),
  scope: z.enum(['window', 'all']).default('all'),
  showDuplicates: z.boolean().default(true),
})

type TabsConfig = z.infer<typeof TabsConfig>

interface TabInfo {
  id: number
  windowId: number
  title: string
  url: string
}

function TabsWidget({ config }: WidgetProps<TabsConfig>) {
  return (
    <PermissionGate needs={['tabs']} reason="Listing your tabs needs access to them.">
      <TabList config={config} />
    </PermissionGate>
  )
}

function TabList({ config }: { config: TabsConfig }) {
  const [filter, setFilter] = useState('')
  /** Bumped after closing tabs, to re-read the list. */
  const [revision, setRevision] = useState(0)

  const tabs = useAsyncValue(`tabs:${config.scope}:${revision}`, () => readTabs(config.scope))

  if (!tabs) return <ListLoading />

  const needle = filter.trim().toLowerCase()
  const visible = tabs
    .filter(
      (tab) =>
        !needle ||
        tab.title.toLowerCase().includes(needle) ||
        tab.url.toLowerCase().includes(needle),
    )
    .slice(0, config.limit)

  const duplicates = findDuplicates(tabs)

  const closeDuplicates = async () => {
    if (duplicates.length === 0) return
    await chrome.tabs.remove(duplicates.map((tab) => tab.id))
    setRevision((n) => n + 1)
  }

  return (
    <div className="blist">
      <ListHeader
        title={config.scope === 'all' ? 'Open tabs' : 'This window'}
        badge={tabs.length}
        tools={
          config.showDuplicates && duplicates.length > 0 ? (
            <button
              type="button"
              className="blist__dupbtn"
              onClick={() => void closeDuplicates()}
              title={`Close ${duplicates.length} duplicate ${duplicates.length === 1 ? 'tab' : 'tabs'}`}
            >
              <Icon name="duplicate" /> {duplicates.length}
            </button>
          ) : null
        }
      />

      <ListSearch value={filter} onChange={setFilter} placeholder="Filter tabs" />

      {visible.length === 0 ? (
        <ListEmpty>No tab matches that.</ListEmpty>
      ) : (
        <div className="blist__scroll scroll-y">
          {visible.map((tab) => (
            <ListRow
              key={tab.id}
              title={tab.title || hostLabel(tab.url)}
              subtitle={hostLabel(tab.url)}
              image={faviconUrl(tab.url, 32)}
              action="close"
              actionLabel={`Close ${tab.title}`}
              onClick={() => void focusTab(tab)}
              onAction={() => {
                void chrome.tabs.remove(tab.id)
                setRevision((n) => n + 1)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

async function readTabs(scope: TabsConfig['scope']): Promise<TabInfo[]> {
  if (!isExtension() || !chrome.tabs?.query) return []
  try {
    const query = scope === 'window' ? { currentWindow: true } : {}
    const tabs = await chrome.tabs.query(query)
    return tabs
      .filter((tab) => tab.id !== undefined && tab.url)
      .map((tab) => ({
        id: tab.id!,
        windowId: tab.windowId,
        title: tab.title ?? '',
        url: tab.url ?? '',
      }))
  } catch {
    return []
  }
}

/** Every tab beyond the first for a given URL, so the originals are kept. */
function findDuplicates(tabs: TabInfo[]): TabInfo[] {
  const seen = new Set<string>()
  const extras: TabInfo[] = []
  for (const tab of tabs) {
    const key = tab.url.replace(/#.*$/, '')
    if (seen.has(key)) extras.push(tab)
    else seen.add(key)
  }
  return extras
}

async function focusTab(tab: TabInfo): Promise<void> {
  await chrome.tabs.update(tab.id, { active: true })
  await chrome.windows.update(tab.windowId, { focused: true })
}

registerWidget<TabsConfig>({
  type: 'tabs',
  name: 'Open tabs',
  description: 'Jump to any open tab, and close the duplicates in one click.',
  icon: 'tabs',
  configSchema: TabsConfig,
  defaultSize: { w: 8, h: 6 },
  minSize: { w: 4, h: 4 },
  permissions: ['tabs'],
  Component: TabsWidget,
  fields: [
    {
      path: 'scope',
      label: 'Include',
      control: {
        kind: 'segmented',
        options: [
          { value: 'all', label: 'All windows' },
          { value: 'window', label: 'This window' },
        ],
      },
    },
    { path: 'limit', label: 'How many', control: { kind: 'slider', min: 5, max: 60 } },
    {
      path: 'showDuplicates',
      label: 'Duplicate finder',
      help: 'Shows a count of repeated pages, and closes the extras when clicked.',
      control: { kind: 'toggle' },
    },
  ],
})
