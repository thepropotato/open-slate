import { useState } from 'react'
import { z } from 'zod'
import { useAsyncValue } from '@/core/hooks'
import { faviconUrl, isExtension, openUrl } from '@/core/platform/browser'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { hostLabel } from '@/features/search/providers'
import {
  ListEmpty,
  ListHeader,
  ListLoading,
  ListRow,
  PermissionGate,
} from '@/features/widgets/shared/ListShell'

// Bookmarks pane. Folders open in place with a breadcrumb rather than expanding
// a tree, which reads better at widget size.

const BookmarksConfig = z.object({
  /** Chrome bookmark node id. Empty means the bookmarks bar. */
  folderId: z.string().default(''),
  limit: z.number().min(5).max(60).default(20),
  showHost: z.boolean().default(true),
  openInNewTab: z.boolean().default(false),
})

type BookmarksConfig = z.infer<typeof BookmarksConfig>

interface Crumb {
  id: string
  title: string
}

function BookmarksWidget({ config }: WidgetProps<BookmarksConfig>) {
  return (
    <PermissionGate needs={['bookmarks']} reason="Showing bookmarks needs access to them.">
      <BookmarkBrowser config={config} />
    </PermissionGate>
  )
}

function BookmarkBrowser({ config }: { config: BookmarksConfig }) {
  const [trail, setTrail] = useState<Crumb[]>([])
  const current = trail.at(-1)?.id ?? config.folderId

  const children = useAsyncValue(`bookmarks:${current}:${config.limit}`, () =>
    readFolder(current, config.limit),
  )

  if (!children) return <ListLoading />

  const back = () => setTrail((path) => path.slice(0, -1))

  return (
    <div className="blist">
      {trail.length > 0 ? (
        <ListHeader
          title={trail.at(-1)?.title ?? 'Folder'}
          tools={
            <button type="button" className="blist__rowaction" onClick={back} style={{ opacity: 1, position: 'static' }} title="Back">
              Back
            </button>
          }
        />
      ) : null}

      {children.length === 0 ? (
        <ListEmpty>This folder is empty.</ListEmpty>
      ) : (
        <div className="blist__scroll scroll-y">
          {children.map((node) =>
            node.url ? (
              <ListRow
                key={node.id}
                title={node.title || hostLabel(node.url)}
                subtitle={config.showHost ? hostLabel(node.url) : undefined}
                image={faviconUrl(node.url, 32)}
                onClick={() => openUrl(node.url!, config.openInNewTab ? 'newTab' : 'current')}
              />
            ) : (
              <ListRow
                key={node.id}
                title={node.title || 'Folder'}
                icon="folder"
                action="chevronRight"
                onClick={() => setTrail((path) => [...path, { id: node.id, title: node.title }])}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}

async function readFolder(
  folderId: string,
  limit: number,
): Promise<chrome.bookmarks.BookmarkTreeNode[]> {
  if (!isExtension() || !chrome.bookmarks?.getChildren) return []
  try {
    // The bookmarks bar is always node "1".
    const id = folderId || '1'
    const children = await chrome.bookmarks.getChildren(id)
    // Folders first, so navigation is not buried under a long list of links.
    return [...children]
      .sort((a, b) => Number(Boolean(a.url)) - Number(Boolean(b.url)))
      .slice(0, limit)
  } catch {
    return []
  }
}

registerWidget<BookmarksConfig>({
  type: 'bookmarks',
  name: 'Bookmarks',
  description: 'Browse a bookmarks folder without opening the manager.',
  icon: 'bookmark',
  configSchema: BookmarksConfig,
  sizes: ['medium', 'large', 'xlarge'],
  defaultSize: 'large',
  permissions: ['bookmarks'],
  Component: BookmarksWidget,
  fields: [
    {
      path: 'folderId',
      label: 'Starting folder',
      help: 'A Chrome bookmark folder id. Empty starts at the bookmarks bar.',
      control: { kind: 'text', placeholder: 'Bookmarks bar' },
    },
    { path: 'limit', label: 'How many', control: { kind: 'slider', min: 5, max: 60 } },
    { path: 'showHost', label: 'Show the site', control: { kind: 'toggle' } },
    { path: 'openInNewTab', label: 'Open in a new tab', control: { kind: 'toggle' } },
  ],
})
