import { z } from 'zod'
import { useAsyncValue } from '@/core/hooks'
import { faviconUrl, isExtension, openUrl } from '@/core/platform/browser'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { hostLabel } from '@/features/search/providers'
import { ListEmpty, ListLoading, ListRow } from '@/features/widgets/shared/ListShell'

/**
 * The browser's own most-visited list.
 *
 * Complements the tiles rather than duplicating them: tiles are what the user
 * chose to pin, this is what they actually visit, and it updates itself.
 */

const TopSitesConfig = z.object({
  limit: z.number().min(4).max(30).default(10),
  layout: z.enum(['grid', 'list']).default('grid'),
  iconSize: z.number().min(16).max(48).default(26),
  showLabels: z.boolean().default(true),
})

type TopSitesConfig = z.infer<typeof TopSitesConfig>

function TopSitesWidget({ config }: WidgetProps<TopSitesConfig>) {
  const sites = useAsyncValue(`topsites:${config.limit}`, async () => {
    if (!isExtension() || !chrome.topSites?.get) return []
    try {
      const all = await chrome.topSites.get()
      return all.filter((site) => /^https?:/.test(site.url)).slice(0, config.limit)
    } catch {
      return []
    }
  })

  if (!sites) return <ListLoading />
  if (sites.length === 0) return <ListEmpty>No most-visited sites yet.</ListEmpty>

  if (config.layout === 'list') {
    return (
      <div className="blist scroll-y">
        {sites.map((site) => (
          <ListRow
            key={site.url}
            title={site.title || hostLabel(site.url)}
            subtitle={hostLabel(site.url)}
            image={faviconUrl(site.url, 32)}
            onClick={() => openUrl(site.url)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="bgrid" style={{ ['--bgrid-min' as string]: `${config.iconSize * 2.6}px` }}>
      {sites.map((site) => (
        <button
          key={site.url}
          type="button"
          className="bgrid__item"
          onClick={() => openUrl(site.url)}
          title={site.title || site.url}
        >
          <span className="bgrid__icon" style={{ width: config.iconSize, height: config.iconSize }}>
            <img
              src={faviconUrl(site.url, 64)}
              alt=""
              width={config.iconSize}
              height={config.iconSize}
              loading="lazy"
            />
          </span>
          {config.showLabels ? (
            <span className="bgrid__label">{site.title || hostLabel(site.url)}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

registerWidget<TopSitesConfig>({
  type: 'topsites',
  name: 'Most visited',
  description: "The browser's own top sites, kept up to date for you.",
  icon: 'star',
  configSchema: TopSitesConfig,
  defaultSize: { w: 7, h: 4 },
  minSize: { w: 3, h: 2 },
  Component: TopSitesWidget,
  fields: [
    {
      path: 'layout',
      label: 'Layout',
      control: {
        kind: 'segmented',
        options: [
          { value: 'grid', label: 'Grid' },
          { value: 'list', label: 'List' },
        ],
      },
    },
    { path: 'limit', label: 'How many', control: { kind: 'slider', min: 4, max: 30 } },
    {
      path: 'iconSize',
      label: 'Icon size',
      control: { kind: 'slider', min: 16, max: 48, unit: 'px' },
      whenLocal: (c) => c.layout === 'grid',
    },
    {
      path: 'showLabels',
      label: 'Show names',
      control: { kind: 'toggle' },
      whenLocal: (c) => c.layout === 'grid',
    },
  ],
})
