import { useState } from 'react'
import { Icon, type IconName } from '@/core/icons'
import { Button, ConfirmDialog, Row, TextArea } from '@/core/ui'
import { useAsyncValue } from '@/core/hooks'
import { mediaStore } from '@/core/storage/blobStore'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { exportSettings, importSettings } from '@/core/settings/store'
import { applyTheme, encodeTheme } from '@/core/settings/themeCode'
import './DataPanel.css'

/**
 * Backup, restore and sharing.
 *
 * Two different things are on offer here, and keeping them separate matters:
 * a full config file (everything, including tiles and notes) for moving to
 * another machine, and a theme code (the look only) for sharing with someone
 * else without handing over your bookmarks-in-tile-form.
 */
export function DataPanel() {
  const settings = useSettings()
  const { replace, reset } = useSettingsActions()

  const [paste, setPaste] = useState('')
  const [themeInput, setThemeInput] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  /* Anything that overwrites or deletes what is already stored waits here for
     a confirmation, so a stray click cannot take a configuration with it. */
  const [pending, setPending] = useState<Confirmation | null>(null)

  const usage = useAsyncValue('media-usage', () => mediaStore.usage())

  const download = () => {
    const blob = new Blob([exportSettings(settings)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `open-slate-config-${stamp()}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage({ kind: 'ok', text: 'Configuration downloaded.' })
  }

  const loadFile = async (file: File | undefined) => {
    if (!file) return
    // Read before asking: a file that will not parse is a bad-input message,
    // not a question about replacing anything.
    let incoming: ReturnType<typeof importSettings>
    try {
      incoming = importSettings(await file.text())
    } catch (error) {
      setMessage({ kind: 'bad', text: describe(error) })
      return
    }
    setPending({
      title: 'Replace your configuration?',
      body: `Loading ${file.name} overwrites every setting on this device, including tiles, notes and tasks. This cannot be undone.`,
      confirmLabel: 'Replace everything',
      confirmIcon: 'import',
      run: () => {
        replace(incoming)
        setMessage({ kind: 'ok', text: `Loaded ${file.name}.` })
      },
    })
  }

  const applyPaste = () => {
    let incoming: ReturnType<typeof importSettings>
    try {
      incoming = importSettings(paste)
    } catch (error) {
      setMessage({ kind: 'bad', text: describe(error) })
      return
    }
    setPending({
      title: 'Replace your configuration?',
      body: 'Applying this configuration overwrites every setting on this device, including tiles, notes and tasks. This cannot be undone.',
      confirmLabel: 'Replace everything',
      confirmIcon: 'check',
      run: () => {
        replace(incoming)
        setPaste('')
        setMessage({ kind: 'ok', text: 'Configuration applied.' })
      },
    })
  }

  const copyTheme = async () => {
    const code = encodeTheme(settings)
    try {
      await navigator.clipboard.writeText(code)
      setMessage({ kind: 'ok', text: 'Theme code copied.' })
    } catch {
      setThemeInput(code)
      setMessage({ kind: 'ok', text: 'Theme code placed in the box below.' })
    }
  }

  const applyThemeCode = () => {
    try {
      replace(applyTheme(settings, themeInput))
      setThemeInput('')
      setMessage({ kind: 'ok', text: 'Theme applied. Your tiles and notes are untouched.' })
    } catch (error) {
      setMessage({ kind: 'bad', text: describe(error) })
    }
  }

  return (
    <div className="data">
      {message ? (
        <p className="data__msg" data-kind={message.kind}>
          <Icon name={message.kind === 'ok' ? 'check' : 'warning'} /> {message.text}
        </p>
      ) : null}

      <Row title="Full configuration" help="Everything, including tiles, notes and tasks." stacked>
        <div className="data__row">
          <Button icon="export" onClick={download}>
            Download
          </Button>
          <label className="ctl-btn">
            <Icon name="import" />
            <span>Load a file</span>
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => void loadFile(event.target.files?.[0])}
            />
          </label>
        </div>
      </Row>

      <Row title="Or paste a configuration" stacked>
        <TextArea
          value={paste}
          onChange={setPaste}
          placeholder="Paste the contents of a config file here"
          rows={5}
        />
      </Row>
      {paste.trim() ? (
        <div className="data__row">
          <Button variant="primary" icon="check" onClick={applyPaste}>
            Apply
          </Button>
          <Button variant="ghost" onClick={() => setPaste('')}>
            Cancel
          </Button>
        </div>
      ) : null}

      <Row
        title="Theme code"
        help="The look only: palette, shape, wallpaper treatment and layout. No tiles or notes."
        stacked
      >
        <div className="data__row">
          <Button icon="copy" onClick={() => void copyTheme()}>
            Copy this theme
          </Button>
        </div>
      </Row>

      <Row title="Apply a theme code" stacked>
        <TextArea
          value={themeInput}
          onChange={setThemeInput}
          placeholder="nt1.…"
          rows={3}
        />
      </Row>
      {themeInput.trim() ? (
        <div className="data__row">
          <Button variant="primary" icon="check" onClick={applyThemeCode}>
            Apply theme
          </Button>
          <Button variant="ghost" onClick={() => setThemeInput('')}>
            Cancel
          </Button>
        </div>
      ) : null}

      <Row
        title="Stored media"
        help={
          usage
            ? `${formatBytes(usage.used)} used by wallpapers and tile images.`
            : 'Wallpapers and tile images live in this browser only.'
        }
        stacked
      >
        <div className="data__row">
          <Button
            variant="danger"
            icon="remove"
            onClick={() =>
              setPending({
                title: 'Delete all stored media?',
                body: 'Every wallpaper and tile image saved in this browser is removed. Anything you did not download a copy of is gone for good.',
                confirmLabel: 'Delete all media',
                run: () => {
                  void mediaStore.clear()
                  setMessage({ kind: 'ok', text: 'Stored media deleted.' })
                },
              })
            }
          >
            Delete all media
          </Button>
        </div>
      </Row>

      <Row title="Start over" help="Restores every setting to its default." stacked>
        <div className="data__row">
          <Button
            variant="danger"
            icon="reset"
            onClick={() =>
              setPending({
                title: 'Reset every setting?',
                body: 'Appearance, layout, tiles, notes and tasks all go back to their defaults. Download a configuration first if you want a way back.',
                confirmLabel: 'Reset everything',
                confirmIcon: 'reset',
                run: () => {
                  void reset()
                  setMessage({ kind: 'ok', text: 'Everything reset to defaults.' })
                },
              })
            }
          >
            Reset all settings
          </Button>
        </div>
      </Row>

      {pending ? (
        <ConfirmDialog
          title={pending.title}
          body={pending.body}
          confirmLabel={pending.confirmLabel}
          confirmIcon={pending.confirmIcon}
          onCancel={() => setPending(null)}
          onConfirm={() => {
            pending.run()
            setPending(null)
          }}
        />
      ) : null}
    </div>
  )
}

/** A destructive action held until the user says yes. */
interface Confirmation {
  title: string
  body: string
  confirmLabel: string
  confirmIcon?: IconName
  run: () => void
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : 'That did not work.'

/** Local date, so the filename sorts sensibly in a downloads folder. */
function stamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function formatBytes(bytes: number): string {
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
