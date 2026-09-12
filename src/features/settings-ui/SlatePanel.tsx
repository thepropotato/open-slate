import { useState } from 'react'
import { Icon } from '@/core/icons'
import { Button, ConfirmDialog, Row, TextArea } from '@/core/ui'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import {
  applySlate,
  decodeSlate,
  encodePayload,
  encodeSlate,
  slateThumbnail,
  submissionUrl,
  GALLERY_URL,
  type SlatePayload,
} from '@/core/settings/slateCode'
import { SLATE_PRESETS } from '@/core/settings/slatePresets'
import { getWidget } from '@/core/widgets/registry'
import { openUrl } from '@/core/platform/browser'
import { uid } from '@/core/util/id'
import './SlatePanel.css'

/**
 * Slates: starting from a layout, browsing what others have shared, and sharing
 * the one you have built.
 *
 * Its own section rather than a group under Widgets or Layout, because a slate
 * spans both: the widget grid, and the page around it - band order, alignment,
 * width, padding, view mode. Filed under either, half of what it does would sit
 * somewhere the reader was not looking.
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
      setMessage({ kind: 'ok', text: 'Slate copied.' })
    } catch {
      setInput(code)
      setMessage({ kind: 'ok', text: 'Slate placed in the box below.' })
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
      'Apply this slate?',
      `This arranges ${count === 1 ? '1 widget' : `${count} widgets`}, removes the ones you have now, and sets the shape of the page. Tiles, notes and tasks are untouched.`,
      'Slate applied. Your tiles and notes are untouched.',
    )
  }

  return (
    <div className="slatep">
      {message ? (
        <p className="slatep__msg" data-kind={message.kind}>
          <Icon name={message.kind === 'ok' ? 'check' : 'warning'} /> {message.text}
        </p>
      ) : null}

      <Row title="Start from a slate" help="A ready-made slate to begin from. Replaces your widgets and the shape of the page; tiles, notes and tasks are untouched." stacked>
        <div className="slatep__presets">
          {SLATE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="slatep__preset"
              onClick={() =>
                confirmSlate(
                  encodePayload(preset),
                  `Apply the ${preset.name} slate?`,
                  'This replaces your widgets and the shape of the page. Tiles, notes and tasks are untouched.',
                  `${preset.name} slate applied.`,
                )
              }
            >
              <SlateThumb payload={preset} />
              <span className="slatep__presetname">{preset.name}</span>
              <span className="slatep__presetwhat">{preset.description}</span>
            </button>
          ))}
        </div>
      </Row>

      {/* The gallery is on the website, so this is the only thing that tells anyone
          it exists. A link rather than a list: browsing here would mean the
          extension fetching from a server, which it does not do. */}
      <Row
        title="Slates from the community"
        help="Slates other people have built and shared, on the website. Opening one brings it back here to look at before anything changes."
        stacked
      >
        <div className="slatep__row">
          <Button icon="external" onClick={() => openUrl(GALLERY_URL, 'newTab')}>
            Browse community slates
          </Button>
        </div>
      </Row>

      <Row
        title="Share your slate"
        help="A slate code is the arrangement only: the widgets on your grid and the shape of the page around them. No calendars, cities or accounts - whoever applies it points the widgets at their own. Sharing opens a prefilled submission on GitHub, which needs a free GitHub account; you can also copy the code and send it anywhere."
        stacked
      >
        <div className="slatep__row">
          <Button icon="copy" onClick={() => void copy()}>
            Copy my slate
          </Button>
          <Button icon="external" onClick={() => openUrl(submissionUrl(settings), 'newTab')}>
            Share my slate
          </Button>
        </div>
      </Row>

      <Row title="Paste a slate code" stacked>
        <TextArea value={input} onChange={setInput} placeholder="ns1.…" rows={3} />
      </Row>
      {input.trim() ? (
        <div className="slatep__row">
          <Button variant="primary" icon="check" onClick={apply}>
            Apply slate
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
          confirmLabel="Apply slate"
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

/**
 * The shape of a slate, as blocks on its own grid. The same drawing the website
 * makes, from the same geometry: a card that only named the widgets left the
 * reader to imagine the arrangement, which is the one thing a slate is.
 */
function SlateThumb({ payload }: { payload: SlatePayload }) {
  const { columns, rows, cells } = slateThumbnail(payload)
  return (
    <span
      className="slatep__thumb"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
      aria-hidden="true"
    >
      {cells.map((cell, index) => (
        <span
          key={index}
          className="slatep__cell"
          style={{
            gridColumn: `${cell.column} / span ${cell.spanX}`,
            gridRow: `${cell.row} / span ${cell.spanY}`,
          }}
        />
      ))}
    </span>
  )
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : 'That did not work.'
