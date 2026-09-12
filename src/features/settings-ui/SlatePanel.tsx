import { useState } from 'react'
import { Icon } from '@/core/icons'
import { Button, ConfirmDialog, Row, TextArea } from '@/core/ui'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import {
  applySlate,
  decodeSlate,
  encodePayload,
  encodeSlate,
  submissionUrl,
} from '@/core/settings/slateCode'
import { SLATE_PRESETS } from '@/core/settings/slatePresets'
import { getWidget } from '@/core/widgets/registry'
import { openUrl } from '@/core/platform/browser'
import { uid } from '@/core/util/id'
import './SlatePanel.css'

/**
 * Slates: starting from a layout, and sharing the one you have built.
 *
 * This lives beside the grid settings rather than with backup and restore. A
 * slate is not a copy of your data - it is the same arrangement the sliders
 * above it describe, written down: which widgets are on the grid, where they
 * sit, and the columns, spacing and compacting that frame them.
 */
export function SlatePanel() {
  const settings = useSettings()
  const { replace } = useSettingsActions()

  const [input, setInput] = useState('')
  const [message, setMessage] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null)
  const [pending, setPending] = useState<{ title: string; body: string; run: () => void } | null>(
    null,
  )

  // Replacing the grid cannot be undone from here, so every route into it goes
  // through the same confirmation rather than only the pasted one.
  const confirmSlate = (code: string, title: string, body: string, done: string) =>
    setPending({
      title,
      body,
      run: () => {
        try {
          replace(applySlate(settings, code, uid, (type) => getWidget(type) !== undefined))
          setInput('')
          setMessage({ kind: 'ok', text: done })
        } catch (error) {
          setMessage({ kind: 'bad', text: describe(error) })
        }
      },
    })

  const copy = async () => {
    const code = encodeSlate(settings)
    try {
      await navigator.clipboard.writeText(code)
      setMessage({ kind: 'ok', text: 'Slate code copied.' })
    } catch {
      setInput(code)
      setMessage({ kind: 'ok', text: 'Slate code placed in the box below.' })
    }
  }

  const apply = () => {
    let count: number
    // Decoded first so the confirmation can say what is coming, and so a damaged
    // code is reported before anything is offered to replace.
    try {
      count = decodeSlate(input).widgets.length
    } catch (error) {
      setMessage({ kind: 'bad', text: describe(error) })
      return
    }
    confirmSlate(
      input,
      'Replace your layout?',
      `This arranges ${count === 1 ? '1 widget' : `${count} widgets`} and removes the ones you have now. Tiles, notes and tasks are untouched.`,
      'Layout applied. Your tiles and notes are untouched.',
    )
  }

  return (
    <div className="slatep">
      {message ? (
        <p className="slatep__msg" data-kind={message.kind}>
          <Icon name={message.kind === 'ok' ? 'check' : 'warning'} /> {message.text}
        </p>
      ) : null}

      <Row title="Start from a layout" help="Replaces the widgets on your grid." stacked>
        <div className="slatep__presets">
          {SLATE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="slatep__preset"
              onClick={() =>
                confirmSlate(
                  encodePayload(preset),
                  `Use the ${preset.name} layout?`,
                  'This replaces the widgets on your grid. Tiles, notes and tasks are untouched.',
                  `${preset.name} layout applied.`,
                )
              }
            >
              <span className="slatep__presetname">{preset.name}</span>
              <span className="slatep__presetwhat">{preset.description}</span>
            </button>
          ))}
        </div>
      </Row>

      <Row
        title="Share your layout"
        help="A slate code is the arrangement only: which widgets are on the grid and where. No calendars, cities or accounts - whoever applies it points the widgets at their own. Sharing opens a prefilled submission on GitHub, which needs a free GitHub account; you can also copy the code and send it anywhere."
        stacked
      >
        <div className="slatep__row">
          <Button icon="copy" onClick={() => void copy()}>
            Copy this layout
          </Button>
          <Button icon="external" onClick={() => openUrl(submissionUrl(settings), 'newTab')}>
            Share this layout
          </Button>
        </div>
      </Row>

      <Row title="Apply a slate code" stacked>
        <TextArea value={input} onChange={setInput} placeholder="ns1.…" rows={3} />
      </Row>
      {input.trim() ? (
        <div className="slatep__row">
          <Button variant="primary" icon="check" onClick={apply}>
            Apply layout
          </Button>
          <Button variant="ghost" onClick={() => setInput('')}>
            Cancel
          </Button>
        </div>
      ) : null}

      {pending ? (
        <ConfirmDialog
          title={pending.title}
          body={pending.body}
          confirmLabel="Replace layout"
          confirmIcon="check"
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

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : 'That did not work.'
