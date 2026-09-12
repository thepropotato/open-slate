import { useState } from 'react'
import { Icon, type IconName } from '@/core/icons'
import { Button, ConfirmDialog, Row, TextArea } from '@/core/ui'
import { useAsyncValue } from '@/core/hooks'
import { mediaStore } from '@/core/storage/blobStore'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { exportSettings, importSettings } from '@/core/settings/store'
import { applyTheme, encodeTheme } from '@/core/settings/themeCode'
import { applySlate, decodeSlate, encodePayload, encodeSlate } from '@/core/settings/slateCode'
import { SLATE_PRESETS } from '@/core/settings/slatePresets'
import { getWidget } from '@/core/widgets/registry'
import { uid } from '@/core/util/id'
import './DataPanel.css'

/**
 * Backup, restore and sharing. Three separate things: a full config file
 * (including tiles and notes) for moving machines, a theme code (the look only),
 * and a slate code (the arrangement only). Neither code carries anything
 * personal, which is what makes them safe to paste into a chat.
 */
export function DataPanel() {
  const settings = useSettings()
  const { replace, reset } = useSettingsActions()

  const [paste, setPaste] = useState('')
  const [themeInput, setThemeInput] = useState('')
  const [slateInput, setSlateInput] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  // Anything overwriting or deleting stored data waits here for a confirmation.
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
    // Read before asking: an unparsable file is a bad-input message, not a
    // question about replacing anything.
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

  // Replacing the grid is not recoverable from the panel, so every route into it
  // goes through the same confirmation rather than only the pasted one.
  const confirmSlate = (code: string, title: string, body: string, done: string) =>
    setPending({
      title,
      body,
      confirmLabel: 'Replace layout',
      confirmIcon: 'check',
      run: () => {
        try {
          replace(applySlate(settings, code, uid, (type) => getWidget(type) !== undefined))
          setSlateInput('')
          setMessage({ kind: 'ok', text: done })
        } catch (error) {
          setMessage({ kind: 'bad', text: describe(error) })
        }
      },
    })

  const copySlate = async () => {
    const code = encodeSlate(settings)
    try {
      await navigator.clipboard.writeText(code)
      setMessage({ kind: 'ok', text: 'Slate code copied.' })
    } catch {
      setSlateInput(code)
      setMessage({ kind: 'ok', text: 'Slate code placed in the box below.' })
    }
  }

  const applySlateCode = () => {
    let count: number
    // Decoded first so the confirmation can say what is coming, and so a damaged
    // code is reported before anything is offered to replace.
    try {
      count = decodeSlate(slateInput).widgets.length
    } catch (error) {
      setMessage({ kind: 'bad', text: describe(error) })
      return
    }
    confirmSlate(
      slateInput,
      'Replace your layout?',
      `This arranges ${count === 1 ? '1 widget' : `${count} widgets`} and removes the ones you have now. Tiles, notes and tasks are untouched.`,
      'Layout applied. Your tiles and notes are untouched.',
    )
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
        title="Slate code"
        help="The arrangement only: which widgets are on the grid and where. No calendars, cities or accounts - whoever applies it points the widgets at their own."
        stacked
      >
        <div className="data__row">
          <Button icon="copy" onClick={() => void copySlate()}>
            Copy this layout
          </Button>
        </div>
      </Row>

      <Row title="Start from a layout" help="Replaces the widgets on your grid." stacked>
        <div className="data__presets">
          {SLATE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="data__preset"
              onClick={() =>
                confirmSlate(
                  encodePayload(preset),
                  `Use the ${preset.name} layout?`,
                  'This replaces the widgets on your grid. Tiles, notes and tasks are untouched.',
                  `${preset.name} layout applied.`,
                )
              }
            >
              <span className="data__presetname">{preset.name}</span>
              <span className="data__presetwhat">{preset.description}</span>
            </button>
          ))}
        </div>
      </Row>

      <Row title="Or apply a slate code" stacked>
        <TextArea value={slateInput} onChange={setSlateInput} placeholder="ns1.…" rows={3} />
      </Row>
      {slateInput.trim() ? (
        <div className="data__row">
          <Button variant="primary" icon="check" onClick={applySlateCode}>
            Apply layout
          </Button>
          <Button variant="ghost" onClick={() => setSlateInput('')}>
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

      {/* Kept away from the controls and behind a confirmation: ordinary edits
          are discardable, so this is only for starting again. */}
      <Row
        title="Start over"
        help="Restores every setting to its default. To undo a single change you have just made, use Discard at the foot of the sidebar instead."
        stacked
      >
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

// Local date, so the filename sorts sensibly in a downloads folder.
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
