import { useState } from 'react'
import { Icon } from '@/core/icons'
import { Button, Row, Toggle } from '@/core/ui'
import { useAsyncValue } from '@/core/hooks'
import { isExtension } from '@/core/platform/browser'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { clearSync, pullSettings, pushSettings, readSyncState } from '@/core/settings/sync'

/**
 * Cross-device sync controls.
 *
 * Manual push and pull sit alongside the automatic toggle because sync
 * necessarily overwrites: when two devices disagree, the user should be able to
 * say which one wins rather than guessing at the timestamps.
 */
export function SyncPanel() {
  const settings = useSettings()
  const { set, replace } = useSettingsActions()
  const [revision, setRevision] = useState(0)
  const [message, setMessage] = useState('')

  const state = useAsyncValue(`syncstate:${revision}`, readSyncState)
  const refresh = () => setRevision((n) => n + 1)

  if (!isExtension()) {
    return (
      <p className="data__msg" data-kind="ok">
        <Icon name="info" /> Sync is only available when running as an installed extension.
      </p>
    )
  }

  const push = async () => {
    const next = await pushSettings(settings)
    setMessage(next.lastError || 'Sent to your other devices.')
    refresh()
  }

  const pull = async () => {
    const result = await pullSettings(settings)
    if (!result) {
      setMessage('Nothing has been synced from another device yet.')
      return
    }
    replace(result.settings)
    setMessage(`Applied the copy saved ${relative(result.at)}.`)
    refresh()
  }

  const forget = async () => {
    await clearSync()
    setMessage('Synced copy deleted.')
    refresh()
  }

  return (
    <>
      {message ? (
        <p className="data__msg" data-kind={message.includes('Too large') ? 'bad' : 'ok'}>
          <Icon name={message.includes('Too large') ? 'warning' : 'check'} /> {message}
        </p>
      ) : null}

      <Row
        title="Sync across devices"
        help="Uses your Chrome profile's sync storage. Wallpapers and uploaded images stay on this device — they are far too large for it."
      >
        <Toggle
          value={settings.sync.enabled}
          onChange={(value) => set('sync.enabled', value)}
          label="Sync across devices"
        />
      </Row>

      {settings.sync.enabled ? (
        <>
          <Row
            title="Automatic"
            help="Sends changes a few seconds after you make them, and applies changes from other devices on load."
          >
            <Toggle
              value={settings.sync.auto}
              onChange={(value) => set('sync.auto', value)}
              label="Sync automatically"
            />
          </Row>

          <Row
            title="Manual"
            help={
              state
                ? `Last sent ${relative(state.lastPushedAt)}, last applied ${relative(state.lastPulledAt)}.`
                : undefined
            }
            stacked
          >
            <div className="data__row">
              <Button icon="upstream" onClick={() => void push()}>
                Send this device
              </Button>
              <Button icon="download" onClick={() => void pull()}>
                Apply the synced copy
              </Button>
              <Button variant="danger" icon="remove" onClick={() => void forget()}>
                Delete synced copy
              </Button>
            </div>
          </Row>

          {state?.lastError ? (
            <p className="data__msg" data-kind="bad">
              <Icon name="warning" /> {state.lastError}
            </p>
          ) : null}
        </>
      ) : null}
    </>
  )
}

function relative(timestamp: number): string {
  if (!timestamp) return 'never'
  const minutes = Math.round((Date.now() - timestamp) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' }).format(timestamp)
}
