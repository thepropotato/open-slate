import { useState } from 'react'
import { Button } from '@/core/ui'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { topSitesNotIn } from './seed'

/**
 * Appends the browser's most-visited sites that are not already pinned.
 *
 * Deliberately an action rather than a live "always include top sites" toggle:
 * a speed dial that silently reorders itself as browsing habits shift is
 * disorienting, and undoing it means deleting tiles one by one.
 */
export function TopSitesAction() {
  const { tiles } = useSettings()
  const { update } = useSettingsActions()
  const [added, setAdded] = useState<number | null>(null)

  const run = async () => {
    const fresh = await topSitesNotIn(tiles.items)
    setAdded(fresh.length)
    if (fresh.length === 0) return
    update((current) => ({
      ...current,
      tiles: { ...current.tiles, items: [...current.tiles.items, ...fresh] },
    }))
  }

  return (
    <>
      <Button icon="history" onClick={() => void run()}>
        Add most-visited
      </Button>
      {added !== null ? (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>
          {added === 0 ? 'Nothing new to add' : `Added ${added}`}
        </span>
      ) : null}
    </>
  )
}
