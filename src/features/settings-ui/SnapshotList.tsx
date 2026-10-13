import { useState } from 'react'
import { Button } from '@/core/ui'
import { useAsyncValue } from '@/core/hooks'
import { useSettingsActions } from '@/core/settings/SettingsProvider'
import { listSnapshots, snapshotSettings } from '@/core/settings/snapshots'
import './SnapshotList.css'

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

function ago(at: number): string {
  const minutes = Math.round((at - Date.now()) / 60_000)
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 48) return relative.format(hours, 'hour')
  return relative.format(Math.round(hours / 24), 'day')
}

/** Settings as they were before each of the last few saves, each one click from restored. */
export function SnapshotList() {
  const { replace } = useSettingsActions()
  const [tick, setTick] = useState(0)
  const snapshots = useAsyncValue(`snapshots:${tick}`, listSnapshots)

  if (!snapshots) return null
  if (snapshots.length === 0) {
    return <p className="snapshots__empty">Nothing yet. A copy is kept each time you save a change.</p>
  }

  return (
    <ul className="snapshots">
      {snapshots.map((snapshot) => (
        <li key={snapshot.at} className="snapshots__row">
          <span>Before a change {ago(snapshot.at)}</span>
          <Button
            variant="ghost"
            icon="reset"
            onClick={() => {
              replace(snapshotSettings(snapshot))
              setTick((current) => current + 1)
            }}
          >
            Restore
          </Button>
        </li>
      ))}
    </ul>
  )
}
