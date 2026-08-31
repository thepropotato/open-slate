import { Icon } from '@/core/icons'
import { Button, TextInput } from '@/core/ui'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { uid } from '@/core/util/id'
import { ROOT } from './folders'
import './PageManager.css'

// Add, rename and remove tile pages. The first page is implicit and cannot be
// removed; deleting a later one moves its tiles there.
export function PageManager() {
  const { tiles } = useSettings()
  const { update } = useSettingsActions()

  const addPage = () =>
    update((current) => ({
      ...current,
      tiles: {
        ...current.tiles,
        pages: [...current.tiles.pages, { id: uid('pg'), name: '' }],
      },
    }))

  const renamePage = (id: string, name: string) =>
    update((current) => ({
      ...current,
      tiles: {
        ...current.tiles,
        pages: current.tiles.pages.map((page) => (page.id === id ? { ...page, name } : page)),
      },
    }))

  const removePage = (id: string) =>
    update((current) => ({
      ...current,
      tiles: {
        ...current.tiles,
        pages: current.tiles.pages.filter((page) => page.id !== id),
        items: current.tiles.items.map((tile) =>
          tile.pageId === id ? { ...tile, pageId: ROOT } : tile,
        ),
      },
    }))

  const countOn = (id: string) =>
    tiles.items.filter((tile) => (tile.pageId || ROOT) === id && !tile.parentId).length

  return (
    <div className="pages">
      <div className="pages__row">
        <span className="pages__name">Main</span>
        <span className="pages__count">{countOn(ROOT)} tiles</span>
      </div>

      {tiles.pages.map((page, index) => (
        <div className="pages__row" key={page.id}>
          <TextInput
            value={page.name}
            onChange={(name) => renamePage(page.id, name)}
            placeholder={`Page ${index + 2}`}
          />
          <span className="pages__count">{countOn(page.id)} tiles</span>
          <button
            type="button"
            className="pages__remove is-icon-btn"
            onClick={() => removePage(page.id)}
            title="Remove this page, moving its tiles to Main"
            aria-label={`Remove page ${page.name || index + 2}`}
          >
            <Icon name="remove" />
          </button>
        </div>
      ))}

      <Button icon="add" onClick={addPage}>
        Add a page
      </Button>
    </div>
  )
}
