import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '@/core/icons'
import { Button } from '@/core/ui'
import { triggerAdd } from '@/core/events'
import { useSetting, useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { presetRef, presetThumb } from '@/features/background/presets'
import { seedTilesFromBrowser } from '@/features/tiles/seed'
import { useOnboarding } from './OnboardingProvider'
import { TASKS, allDone, withTask, type TaskId } from './state'
import './Onboarding.css'

const LOOKS = [
  { id: 'dawn', label: 'Dawn' },
  { id: 'aurora', label: 'Aurora' },
  { id: 'tide', label: 'Tide' },
  { id: 'dunes', label: 'Dunes' },
] as const

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd' : 'Ctrl'

const STEPS = [
  {
    target: 'search',
    title: 'Search, or jump anywhere',
    body: `Type to search the web. Press ${MOD} K to open the palette and reach tiles, settings and actions from the keyboard.`,
  },
  {
    target: 'tiles',
    title: 'These are your tiles',
    body: 'Hover one to edit it. Press E to arrange the page, and drop one tile on another to make a folder.',
  },
  {
    target: 'dock',
    title: 'Add things from the plus',
    body: 'Tiles, widgets and folders all start there. Customise sits beside it, with a live preview.',
  },
  {
    target: 'toolbar',
    title: 'Save any page as a tile',
    body: 'Pin Open Slate from the puzzle icon in Chrome’s toolbar. One click there adds the page you are on, without opening a new tab.',
  },
] as const

/** What the new tab tells the checklist is happening, so it can tick items off. */
export interface Signals {
  paletteOpen: boolean
  arranging: boolean
  onPalette: () => void
  onArrange: () => void
}

export function Onboarding({ signals }: { signals: Signals }) {
  const onboarding = useOnboarding()
  const stage = onboarding?.ready ? onboarding.state?.stage : undefined
  if (stage === 'welcome') return <Welcome />
  if (stage === 'tour') return <Tour />
  if (stage === 'checklist') return <Checklist signals={signals} />
  return null
}

function Welcome() {
  const onboarding = useOnboarding()!
  const { update } = useSettingsActions()
  const [type, setType] = useSetting<string>('background.type')
  const [url, setUrl] = useSetting<string>('background.image.url')
  const [, setBlob] = useSetting<string>('background.image.blobId')
  const seed = onboarding.state?.seed !== false

  const choose = (id: string) => {
    setBlob('')
    setUrl(presetRef(id))
    setType('image')
  }

  // The page behind the card follows the choice, so what it does is visible.
  const toggleSeed = async () => {
    const next = !seed
    onboarding.patch({ seed: next })
    const items = next ? await seedTilesFromBrowser() : []
    update((current) => ({ ...current, tiles: { ...current.tiles, items } }))
  }

  return (
    <div className="ob-welcome" role="dialog" aria-label="Welcome to Open Slate">
      <div className="ob-card ob-card--welcome">
        <h2 className="ob-title">Welcome to Open Slate</h2>
        <p className="ob-body">A new tab you arrange yourself. Pick a starting look; you can change everything later.</p>
        <div className="ob-label">Look</div>
        <div className="ob-looks">
          {LOOKS.map((look) => (
            <button
              key={look.id}
              type="button"
              className="ob-look"
              aria-pressed={type === 'image' && url === presetRef(look.id)}
              title={look.label}
              onClick={() => choose(look.id)}
              style={{ backgroundImage: `url(${presetThumb(look.id)})` }}
            >
              <span className="ob-look__name">{look.label}</span>
            </button>
          ))}
        </div>
        <label className="ob-toggle">
          <input type="checkbox" checked={seed} onChange={() => void toggleSeed()} />
          <span className="ob-toggle__track" aria-hidden />
          <span>
            Start with my most visited sites
            <small>Read once on this device. Nothing leaves it.</small>
          </span>
        </label>
        <div className="ob-actions">
          <Button variant="ghost" onClick={() => onboarding.finish()}>
            Skip tour
          </Button>
          <Button variant="primary" onClick={() => onboarding.start('tour')}>
            Show me around
          </Button>
        </div>
      </div>
    </div>
  )
}

interface Box {
  left: number
  top: number
  width: number
  height: number
}

const PAD = 10

function measure(target: string): Box | null {
  const element = document.querySelector<HTMLElement>(`[data-tour="${target}"]`)
  const rect = element?.getBoundingClientRect()
  if (!rect || rect.width === 0 || rect.height === 0) return null
  return {
    left: Math.max(0, rect.left - PAD),
    top: Math.max(0, rect.top - PAD),
    width: Math.min(window.innerWidth, rect.width + PAD * 2),
    height: Math.min(window.innerHeight, rect.height + PAD * 2),
  }
}

function Tour() {
  const onboarding = useOnboarding()!
  const [index, setIndex] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const [cardHeight, setCardHeight] = useState(180)
  const card = useRef<HTMLDivElement>(null)
  const step = STEPS[index]!
  const last = index === STEPS.length - 1

  const end = () => onboarding.start('checklist')
  const next = () => (last ? end() : setIndex(index + 1))

  useLayoutEffect(() => {
    const place = () => {
      setBox(step.target === 'toolbar' ? null : measure(step.target))
      setCardHeight(card.current?.offsetHeight ?? 180)
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [step.target])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') end()
      else if (event.key === 'Enter' || event.key === 'ArrowRight') next()
      else if (event.key === 'ArrowLeft' && index > 0) setIndex(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const width = Math.min(360, window.innerWidth - 32)
  const place = cardPosition(step.target, box, width, cardHeight)

  return (
    <div className="ob-tour" role="dialog" aria-label="Quick tour">
      {box ? (
        <div
          className="ob-hole"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
        />
      ) : (
        <div className="ob-dim" />
      )}
      <div
        ref={card}
        className="ob-card ob-card--tour"
        data-pointer={step.target === 'toolbar' ? 'up' : undefined}
        style={{ ...place, width }}
      >
        <h3 className="ob-title ob-title--sm">{step.title}</h3>
        <p className="ob-body">{step.body}</p>
        <div className="ob-actions ob-actions--tour">
          <span className="ob-dots" aria-label={`Step ${index + 1} of ${STEPS.length}`}>
            {STEPS.map((_, i) => (
              <i key={i} data-on={i === index} />
            ))}
          </span>
          <Button variant="ghost" onClick={end}>
            Skip
          </Button>
          <Button variant="primary" onClick={next}>
            {last ? 'Done' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  )
}

const GAP = 16

/** Beside the highlighted control where there is room, otherwise centred; the toolbar note sits under the browser's own toolbar. */
function cardPosition(target: string, box: Box | null, width: number, height: number): React.CSSProperties {
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (target === 'toolbar') return { right: 24, top: 24 }
  if (!box) return { left: (vw - width) / 2, top: Math.max(16, (vh - height) / 2) }
  const left = Math.min(Math.max(16, box.left + box.width / 2 - width / 2), vw - width - 16)
  const below = box.top + box.height + GAP
  if (below + height <= vh - 16) return { left, top: below }
  const above = box.top - GAP - height
  if (above >= 16) return { left, top: above }
  return { left, top: Math.max(16, vh - height - 16) }
}

function Checklist({ signals }: { signals: Signals }) {
  const onboarding = useOnboarding()!
  const { widgets } = useSettings()
  const state = onboarding.state!
  const count = widgets.instances.length
  const baseline = useRef(count)

  const mark = (id: TaskId) => onboarding.patch((current) => withTask(current, id))

  useEffect(() => {
    if (count > baseline.current) mark('widget')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])
  useEffect(() => {
    if (signals.paletteOpen) mark('palette')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals.paletteOpen])
  useEffect(() => {
    if (signals.arranging) mark('arrange')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals.arranging])

  const complete = allDone(state)
  useEffect(() => {
    if (!complete) return
    const timer = window.setTimeout(() => onboarding.finish(), 2600)
    return () => window.clearTimeout(timer)
  }, [complete, onboarding])

  const run: Record<TaskId, () => void> = {
    widget: () => triggerAdd('widget'),
    palette: signals.onPalette,
    arrange: signals.onArrange,
  }

  const done = state.tasks.length
  return (
    <aside className="ob-list" aria-label="Make it yours">
      <header className="ob-list__head">
        <h3>{complete ? 'You are set' : 'Make it yours'}</h3>
        <span>
          {done} of {TASKS.length}
        </span>
        <button type="button" className="ob-list__close is-icon-btn" title="Dismiss" onClick={() => onboarding.finish()}>
          <Icon name="close" />
        </button>
      </header>
      <div className="ob-bar">
        <i style={{ width: `${(done / TASKS.length) * 100}%` }} />
      </div>
      <ul>
        {TASKS.map((task) => {
          const ticked = state.tasks.includes(task.id)
          return (
            <li key={task.id} data-done={ticked}>
              <button type="button" onClick={run[task.id]} disabled={ticked}>
                <span className="ob-tick" aria-hidden>
                  <Icon name="check" />
                </span>
                <span className="ob-list__label">{task.label}</span>
                <small>{task.id === 'palette' ? `${MOD} K` : task.hint}</small>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}
