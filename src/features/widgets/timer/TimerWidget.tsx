import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { Icon } from '@/core/icons'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { playChime } from './chime'
import './timer.css'

// Pomodoro, countdown and stopwatch. State is absolute timestamps, not a
// decremented countdown, so it survives the page closing and stays consistent
// across open tabs.

const TimerConfig = z.object({
  mode: z.enum(['pomodoro', 'countdown', 'stopwatch']).default('pomodoro'),
  workMinutes: z.number().min(1).max(180).default(25),
  breakMinutes: z.number().min(1).max(60).default(5),
  longBreakMinutes: z.number().min(1).max(120).default(15),
  roundsBeforeLongBreak: z.number().min(2).max(12).default(4),
  autoAdvance: z.boolean().default(true),
  chime: z.boolean().default(true),
  showRounds: z.boolean().default(true),

  // Runtime state, persisted so the timer outlives the page.
  running: z.boolean().default(false),
  /** Epoch ms at which the current phase ends. Zero when not running. */
  endsAt: z.number().default(0),
  /** Milliseconds left while paused. */
  pausedMs: z.number().default(0),
  /** Epoch ms the stopwatch started; zero when stopped. */
  startedAt: z.number().default(0),
  /** Stopwatch milliseconds banked across pauses. */
  elapsedMs: z.number().default(0),
  phase: z.enum(['work', 'break', 'longBreak']).default('work'),
  round: z.number().default(1),
})

type TimerConfig = z.infer<typeof TimerConfig>

function TimerWidget({ config, setConfig }: WidgetProps<TimerConfig>) {
  const [now, setNow] = useState(() => Date.now())
  // Guards against firing the phase change twice across re-renders.
  const firedFor = useRef(0)

  const isStopwatch = config.mode === 'stopwatch'
  const ticking = config.running

  // Displayed value is always derived from timestamps, never accumulated.
  useEffect(() => {
    if (!ticking) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [ticking])

  const remainingMs = config.running
    ? Math.max(0, config.endsAt - now)
    : config.pausedMs || phaseLength(config)

  const stopwatchMs = config.running
    ? config.elapsedMs + Math.max(0, now - config.startedAt)
    : config.elapsedMs

  useEffect(() => {
    if (isStopwatch || !config.running || config.endsAt === 0) return
    if (now < config.endsAt) return
    if (firedFor.current === config.endsAt) return
    firedFor.current = config.endsAt

    if (config.chime) playChime()

    if (config.mode === 'countdown' || !config.autoAdvance) {
      setConfig({ running: false, endsAt: 0, pausedMs: 0 })
      return
    }

    const next = nextPhase(config)
    setConfig({
      phase: next.phase,
      round: next.round,
      endsAt: Date.now() + next.minutes * 60_000,
      pausedMs: 0,
      running: true,
    })
    // `config` is read wholesale here; the effect is driven by the clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, config.running, config.endsAt, isStopwatch])

  const start = () => {
    if (isStopwatch) {
      setConfig({ running: true, startedAt: Date.now() })
      return
    }
    const ms = config.pausedMs || phaseLength(config)
    setConfig({ running: true, endsAt: Date.now() + ms, pausedMs: 0 })
  }

  const pause = () => {
    if (isStopwatch) {
      setConfig({ running: false, elapsedMs: stopwatchMs, startedAt: 0 })
      return
    }
    setConfig({ running: false, pausedMs: Math.max(0, config.endsAt - Date.now()), endsAt: 0 })
  }

  const reset = () => {
    firedFor.current = 0
    setConfig({
      running: false,
      endsAt: 0,
      pausedMs: 0,
      startedAt: 0,
      elapsedMs: 0,
      phase: 'work',
      round: 1,
    })
  }

  const skip = () => {
    const next = nextPhase(config)
    firedFor.current = 0
    setConfig({
      phase: next.phase,
      round: next.round,
      endsAt: config.running ? Date.now() + next.minutes * 60_000 : 0,
      pausedMs: config.running ? 0 : next.minutes * 60_000,
    })
  }

  const total = isStopwatch ? 0 : phaseLength(config)
  const progress = total > 0 ? 1 - remainingMs / total : 0

  return (
    <div className="timer" data-phase={config.phase}>
      <div className="timer__label">
        {isStopwatch
          ? 'Stopwatch'
          : config.mode === 'countdown'
            ? 'Countdown'
            : phaseLabel(config.phase)}
        {config.mode === 'pomodoro' && config.showRounds ? (
          <span className="timer__rounds">
            {config.round}/{config.roundsBeforeLongBreak}
          </span>
        ) : null}
      </div>

      <div className="timer__readout">
        {!isStopwatch ? (
          <svg className="timer__ring" viewBox="-50 -50 100 100" aria-hidden="true">
            <circle className="timer__ringtrack" r="45" />
            <circle
              className="timer__ringvalue"
              r="45"
              strokeDasharray={`${2 * Math.PI * 45 * progress} ${2 * Math.PI * 45}`}
              transform="rotate(-90)"
            />
          </svg>
        ) : null}
        <span className="timer__time">
          {isStopwatch ? formatStopwatch(stopwatchMs) : formatClock(remainingMs)}
        </span>
      </div>

      <div className="timer__controls">
        <button
          type="button"
          className="timer__btn timer__btn--primary is-icon-btn"
          onClick={config.running ? pause : start}
          title={config.running ? 'Pause' : 'Start'}
          aria-label={config.running ? 'Pause' : 'Start'}
        >
          <Icon name={config.running ? 'pause' : 'play'} />
        </button>
        {config.mode === 'pomodoro' ? (
          <button type="button" className="timer__btn is-icon-btn" onClick={skip} title="Skip this phase" aria-label="Skip this phase">
            <Icon name="chevronRight" />
          </button>
        ) : null}
        <button type="button" className="timer__btn is-icon-btn" onClick={reset} title="Reset" aria-label="Reset">
          <Icon name="reset" />
        </button>
      </div>
    </div>
  )
}

const phaseLength = (config: TimerConfig): number =>
  (config.mode === 'countdown'
    ? config.workMinutes
    : config.phase === 'work'
      ? config.workMinutes
      : config.phase === 'break'
        ? config.breakMinutes
        : config.longBreakMinutes) * 60_000

function nextPhase(config: TimerConfig): { phase: TimerConfig['phase']; round: number; minutes: number } {
  if (config.phase !== 'work') {
    // A long break closes the set, so the next work block starts round one.
    const round = config.phase === 'longBreak' ? 1 : config.round + 1
    return { phase: 'work', round, minutes: config.workMinutes }
  }
  const isLast = config.round >= config.roundsBeforeLongBreak
  return isLast
    ? { phase: 'longBreak', round: config.round, minutes: config.longBreakMinutes }
    : { phase: 'break', round: config.round, minutes: config.breakMinutes }
}

const phaseLabel = (phase: TimerConfig['phase']): string =>
  phase === 'work' ? 'Focus' : phase === 'break' ? 'Break' : 'Long break'

const pad = (n: number) => String(n).padStart(2, '0')

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}

function formatStopwatch(ms: number): string {
  const total = Math.floor(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const tenths = Math.floor((ms % 1000) / 100)
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}.${tenths}`
}

registerWidget<TimerConfig>({
  type: 'timer',
  name: 'Timer',
  description: 'Pomodoro, a plain countdown, or a stopwatch. Keeps running between tabs.',
  icon: 'timer',
  configSchema: TimerConfig,
  sizes: ['small', 'medium', 'large'],
  defaultSize: 'medium',
  Component: TimerWidget,
  fields: [
    {
      path: 'mode',
      label: 'Mode',
      control: {
        kind: 'segmented',
        options: [
          { value: 'pomodoro', label: 'Pomodoro' },
          { value: 'countdown', label: 'Countdown' },
          { value: 'stopwatch', label: 'Stopwatch' },
        ],
      },
    },
    {
      path: 'workMinutes',
      label: 'Focus length',
      control: { kind: 'slider', min: 1, max: 180, format: (v) => `${v} min` },
      whenLocal: (c) => c.mode !== 'stopwatch',
    },
    {
      path: 'breakMinutes',
      label: 'Break length',
      control: { kind: 'slider', min: 1, max: 60, format: (v) => `${v} min` },
      whenLocal: (c) => c.mode === 'pomodoro',
    },
    {
      path: 'longBreakMinutes',
      label: 'Long break length',
      control: { kind: 'slider', min: 1, max: 120, format: (v) => `${v} min` },
      whenLocal: (c) => c.mode === 'pomodoro',
    },
    {
      path: 'roundsBeforeLongBreak',
      label: 'Rounds before a long break',
      control: { kind: 'slider', min: 2, max: 12 },
      whenLocal: (c) => c.mode === 'pomodoro',
    },
    {
      path: 'autoAdvance',
      label: 'Start the next phase automatically',
      control: { kind: 'toggle' },
      whenLocal: (c) => c.mode === 'pomodoro',
    },
    {
      path: 'showRounds',
      label: 'Show the round count',
      control: { kind: 'toggle' },
      whenLocal: (c) => c.mode === 'pomodoro',
    },
    {
      path: 'chime',
      label: 'Chime when a phase ends',
      help: 'A short synthesised tone. Browsers may block it until you interact with the page.',
      control: { kind: 'toggle' },
      whenLocal: (c) => c.mode !== 'stopwatch',
    },
  ],
})
