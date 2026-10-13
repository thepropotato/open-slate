import { useState } from 'react'
import type { AddTab } from '@/core/events'
import { useSettingsActions } from '@/core/settings/SettingsProvider'
import { WidgetInstance, type Tile } from '@/core/settings/schema'
import { uid } from '@/core/util/id'
import type { AnyWidgetDefinition } from '@/core/widgets/types'
import { TileEditor } from '@/features/tiles/TileEditor'
import { WidgetGallery } from '@/features/widgets/WidgetPicker'

/** One sheet for everything you can put on the page: a tile, a folder or a widget. */
export function AddSheet({
  initialTab,
  pageId,
  onClose,
}: {
  initialTab: AddTab
  pageId: string
  onClose: () => void
}) {
  const { update } = useSettingsActions()
  const [tab, setTab] = useState<AddTab>(initialTab)

  const addTile = (tile: Tile) => {
    update((current) => ({
      ...current,
      tiles: { ...current.tiles, items: [...current.tiles.items, tile] },
    }))
    onClose()
  }

  const addWidget = (definition: AnyWidgetDefinition) => {
    const instance = WidgetInstance.parse({ id: uid('w'), type: definition.type })
    update((current) => ({
      ...current,
      widgets: { ...current.widgets, instances: [...current.widgets.instances, instance] },
    }))
    onClose()
  }

  return (
    <TileEditor
      tile={null}
      initialKind={initialTab === 'folder' ? 'folder' : 'link'}
      initialPageId={pageId}
      tab={tab}
      onTab={setTab}
      widgetGallery={<WidgetGallery onAdd={addWidget} />}
      onSave={addTile}
      onClose={onClose}
    />
  )
}
