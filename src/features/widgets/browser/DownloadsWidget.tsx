import { z } from 'zod'
import { useAsyncValue } from '@/core/hooks'
import { isExtension } from '@/core/platform/browser'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import {
  ListEmpty,
  ListLoading,
  ListRow,
  PermissionGate,
} from '@/features/widgets/shared/ListShell'

/**
 * Recent downloads.
 *
 * Clicking a finished file opens it; clicking one still in progress shows it in
 * the download shelf instead, which is the only useful action at that point.
 */

const DownloadsConfig = z.object({
  limit: z.number().min(3).max(20).default(6),
  onlyComplete: z.boolean().default(false),
  showSize: z.boolean().default(true),
})

type DownloadsConfig = z.infer<typeof DownloadsConfig>

function DownloadsWidget({ config }: WidgetProps<DownloadsConfig>) {
  return (
    <PermissionGate needs={['downloads']} reason="Showing downloads needs access to them.">
      <DownloadList config={config} />
    </PermissionGate>
  )
}

function DownloadList({ config }: { config: DownloadsConfig }) {
  const items = useAsyncValue(`downloads:${config.limit}:${config.onlyComplete}`, async () => {
    if (!isExtension() || !chrome.downloads?.search) return []
    try {
      return await chrome.downloads.search({
        limit: config.limit,
        orderBy: ['-startTime'],
        ...(config.onlyComplete ? { state: 'complete' } : {}),
        exists: true,
      })
    } catch {
      return []
    }
  })

  if (!items) return <ListLoading />
  if (items.length === 0) return <ListEmpty>No recent downloads.</ListEmpty>

  return (
    <div className="blist scroll-y">
      {items.map((item) => {
        const complete = item.state === 'complete'
        const progress =
          item.totalBytes > 0 ? Math.round((item.bytesReceived / item.totalBytes) * 100) : null
        return (
          <ListRow
            key={item.id}
            title={fileName(item.filename) || item.finalUrl || 'Download'}
            subtitle={
              !complete && progress !== null
                ? `${progress}% of ${formatBytes(item.totalBytes)}`
                : config.showSize
                  ? [stateLabel(item.state), formatBytes(item.fileSize || item.totalBytes)]
                      .filter(Boolean)
                      .join(' · ')
                  : stateLabel(item.state)
            }
            icon={complete ? 'download' : 'spinner'}
            action="folder"
            actionLabel="Show in folder"
            onClick={() => {
              if (complete) chrome.downloads.open(item.id)
              else chrome.downloads.show(item.id)
            }}
            onAction={() => chrome.downloads.show(item.id)}
          />
        )
      })}
    </div>
  )
}

const fileName = (path: string): string => path.split(/[\\/]/).pop() ?? path

const stateLabel = (state: string): string =>
  state === 'complete' ? 'Done' : state === 'interrupted' ? 'Stopped' : 'Downloading'

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return ''
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

registerWidget<DownloadsConfig>({
  type: 'downloads',
  name: 'Downloads',
  description: 'The files you just saved, with progress on anything still running.',
  icon: 'download',
  configSchema: DownloadsConfig,
  sizes: ['medium', 'large', 'xlarge'],
  defaultSize: 'medium',
  permissions: ['downloads'],
  Component: DownloadsWidget,
  fields: [
    { path: 'limit', label: 'How many', control: { kind: 'slider', min: 3, max: 20 } },
    { path: 'onlyComplete', label: 'Finished only', control: { kind: 'toggle' } },
    { path: 'showSize', label: 'Show file size', control: { kind: 'toggle' } },
  ],
})
