import { useEffect, useState } from 'react'
import { Icon } from '@/core/icons'
import './Dock.css'

/** The page's controls: three icons in the corner that name themselves on hover, and fade when idle. */
export function Dock({
  arranging,
  zen,
  onAdd,
  onArrange,
  onSettings,
  onWarm,
}: {
  arranging: boolean
  zen: boolean
  onAdd: () => void
  onArrange: () => void
  onSettings: () => void
  /** Fetch the settings chunk early, since a pointer heading for the button is about to click. */
  onWarm: () => void
}) {
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    let timer = window.setTimeout(() => setIdle(true), 2200)
    const wake = () => {
      setIdle(false)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setIdle(true), 2200)
    }
    const events = ['pointermove', 'pointerdown', 'keydown', 'touchstart'] as const
    for (const name of events) window.addEventListener(name, wake, { passive: true })
    return () => {
      window.clearTimeout(timer)
      for (const name of events) window.removeEventListener(name, wake)
    }
  }, [])

  return (
    <nav
      className="page__tools dock"
      aria-label="Page controls"
      data-tour="dock"
      data-zen={zen}
      data-idle={idle && !arranging}
      data-arranging={arranging}
    >
      <button type="button" className="dock__btn" onClick={onAdd} title="Add a tile, folder or widget">
        <Icon name="add" />
        <span className="dock__label">Add</span>
      </button>
      <button
        type="button"
        className="dock__btn"
        data-hot={arranging}
        onClick={onArrange}
        aria-pressed={arranging}
        title={arranging ? 'Done arranging' : 'Arrange the page (E)'}
      >
        <Icon name={arranging ? 'check' : 'drag'} />
        <span className="dock__label">{arranging ? 'Done' : 'Arrange'}</span>
      </button>
      <button
        type="button"
        className="dock__btn"
        onClick={onSettings}
        onPointerEnter={onWarm}
        onFocus={onWarm}
        title="Customise (Ctrl or Cmd + comma)"
      >
        <Icon name="settings" />
        <span className="dock__label">Customise</span>
      </button>
    </nav>
  )
}

/** Says what arrange mode is and how to leave it, so the faint dashed slots are not the only clue. */
export function ArrangeBanner({ onDone }: { onDone: () => void }) {
  return (
    <div className="arrange-banner" role="status">
      <strong>Arranging</strong>
      <span>Drag to move, pull a corner to resize</span>
      <button type="button" className="arrange-banner__done" onClick={onDone}>
        Done
      </button>
    </div>
  )
}
