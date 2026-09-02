import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { Icon } from '@/core/icons'
import { useAsyncValue, useNow } from '@/core/hooks'
import { Button, TextInput } from '@/core/ui'
import { openUrl } from '@/core/platform/browser'
import { useSettings } from '@/core/settings/SettingsProvider'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { resolveLocale } from '@/core/util/time'
import {
  colorOf,
  loadCalendars,
  normaliseUrl,
  probeCalendar,
  requestCalendarAccess,
  urlLabel,
  type CalendarSource,
  type LoadedCalendar,
} from './api'
import type { CalendarEvent } from './ics'
import { CalendarList } from './CalendarList'
import './calendar.css'

// Month grid over iCalendar subscriptions (see `api.ts`). Connected, the widget
// is two whole-card views - a day and a month - rather than one card split in
// half, which gave neither view enough room.

const CalendarSourceSchema = z.object({
  url: z.string().default(''),
  name: z.string().default(''),
  color: z.number().default(0),
})

const CalendarConfig = z.object({
  /** `auto` takes the first day of the week from the locale. */
  weekStart: z.enum(['auto', 'monday', 'sunday', 'saturday']).default('auto'),
  showWeekNumbers: z.boolean().default(false),
  showAdjacentMonths: z.boolean().default(true),
  highlightWeekend: z.boolean().default(true),
  sources: z.array(CalendarSourceSchema).default([]),
  // Off, the widget is only ever the month grid and dates stop opening a day.
  showAgenda: z.boolean().default(true),
  maxDots: z.number().min(1).max(5).default(3),
})

type CalendarConfig = z.infer<typeof CalendarConfig>

function CalendarWidget({ config, setConfig }: WidgetProps<CalendarConfig>) {
  const { behavior } = useSettings()
  const locale = resolveLocale(behavior.locale)
  const today = useNow('minute')
  /** Months away from the current one, so "today" survives midnight. */
  const [offset, setOffset] = useState(0)
  /** Epoch ms of local midnight on the selected day; null means today. */
  const [selected, setSelected] = useState<number | null>(null)
  // Connected widgets open on `day`: a grid of dots tells you nothing until clicked.
  const [pane, setPane] = useState<'month' | 'day'>('day')
  /** Bumped to re-fetch past the cache. */
  const [revision, setRevision] = useState(0)
  const [setup, setSetup] = useState(false)

  const view = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const weekStart = resolveWeekStart(config.weekStart, locale)
  const cells = monthCells(view, weekStart)

  // The whole visible grid, so leading and trailing days are fetched too.
  const from = cells[0][0].getTime()
  const to = cells[5][6].getTime() + 86_400_000

  const sources = config.sources.filter((source) => source.url)
  const calendars = useAsyncValue(
    sources.length > 0 ? `cal:${sources.map((s) => s.url).join(',')}:${from}:${revision}` : null,
    () => loadCalendars(sources, from, to, revision > 0),
  )

  const byDay = groupByDay(calendars ?? [], from, to)

  const dayNames = weekdayNames(locale, weekStart)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const selectedDay = selected ?? startOfToday
  // Today is already marked, so the selection ring only appears once a day is
  // actually chosen.
  const showSelection = selected !== null && selected !== startOfToday
  const needsPermission = (calendars ?? []).filter((cal) => cal.error === 'needs-permission')

  // The grid is always the face; setup is offered by the header `+`, never opened
  // unasked.
  if (setup) {
    return (
      <CalendarSetup
        existing={config.sources}
        onAdd={(source) => {
          setConfig({ sources: [...config.sources, source] })
          setSetup(false)
        }}
        onCancel={() => setSetup(false)}
      />
    )
  }

  const agenda = byDay.get(selectedDay) ?? []

  // The day pane needs both a calendar and the agenda setting on.
  const dayPane = pane === 'day' && config.showAgenda && sources.length > 0

  if (dayPane) {
    return (
      <div className="cal" data-pane="day">
        <DayView
          day={selectedDay}
          events={agenda}
          locale={locale}
          loading={calendars === null}
          isToday={selectedDay === startOfToday}
          now={today.getTime()}
          refreshing={calendars === null && revision > 0}
          onRefresh={() => setRevision((n) => n + 1)}
          onBack={() => setPane('month')}
        />
        {needsPermission.length > 0 ? (
          <GrantNotice
            calendars={needsPermission}
            onGrant={() =>
              void Promise.all(
                needsPermission.map((cal) => requestCalendarAccess(cal.url)),
              ).then(() => setRevision((n) => n + 1))
            }
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="cal" data-pane="month">
      <header className="cal__head">
        <button
          type="button"
          className="is-icon-btn"
          onClick={() => setOffset((n) => n - 1)}
          aria-label="Previous month"
          title="Previous month"
        >
          <Icon name="chevronLeft" />
        </button>

        <button
          type="button"
          className="cal__title"
          onClick={() => {
            setOffset(0)
            setSelected(null)
          }}
          title="Back to this month"
        >
          {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(view)}
        </button>

        {/* `+` stays after the first calendar, since a second is common. */}
        {sources.length > 0 ? (
          <button
            type="button"
            className="cal__aux is-icon-btn"
            onClick={() => setRevision((n) => n + 1)}
            aria-label="Check for changes"
            title="Check for changes"
          >
            <Icon
              name={calendars === null && revision > 0 ? 'spinner' : 'reset'}
              spin={calendars === null && revision > 0}
            />
          </button>
        ) : null}

        <button
          type="button"
          className="cal__add is-icon-btn"
          onClick={() => setSetup(true)}
          aria-label="Connect a calendar"
          title="Connect a calendar"
        >
          <Icon name="add" />
        </button>

        <button
          type="button"
          className="is-icon-btn"
          onClick={() => setOffset((n) => n + 1)}
          aria-label="Next month"
          title="Next month"
        >
          <Icon name="chevronRight" />
        </button>
      </header>

      {needsPermission.length > 0 ? (
        <GrantNotice
          calendars={needsPermission}
          onGrant={() =>
            void Promise.all(
              needsPermission.map((cal) => requestCalendarAccess(cal.url)),
            ).then(() => setRevision((n) => n + 1))
          }
        />
      ) : null}

      <div className="cal__body">
        <div className="cal__wrap">
          <div className="cal__grid" data-weeks={config.showWeekNumbers}>
            {config.showWeekNumbers ? <span className="cal__wk" /> : null}
            {/* Keyed by index: narrow weekday names repeat (T, T and S, S). */}
              {dayNames.map((name, index) => {
              const weekday = (weekStart + index) % 7
              return (
                <span
                  key={index}
                  className="cal__dayname"
                  data-weekend={weekday === 0 || weekday === 6}
                >
                  {name}
                </span>
              )
            })}

            {cells.map((week, index) => (
              <Week
                key={index}
                week={week}
                month={view.getMonth()}
                config={config}
                startOfToday={startOfToday}
                selectedDay={showSelection ? selectedDay : null}
                byDay={byDay}
                onSelect={(day) => {
                  setSelected(day)
                  if (config.showAgenda && sources.length > 0) setPane('day')
                }}
                interactive={sources.length > 0}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

function Week({
  week,
  month,
  config,
  startOfToday,
  selectedDay,
  byDay,
  onSelect,
  interactive,
}: {
  week: Date[]
  month: number
  config: CalendarConfig
  startOfToday: number
  selectedDay: number | null
  byDay: Map<number, DayEvent[]>
  onSelect: (day: number) => void
  interactive: boolean
}) {
  return (
    <>
      {config.showWeekNumbers ? <span className="cal__wk">{isoWeek(week[0])}</span> : null}
      {week.map((date) => {
        const outside = date.getMonth() !== month
        if (outside && !config.showAdjacentMonths) {
          return <span key={date.toISOString()} className="cal__cell" />
        }
        const day = date.getTime()
        const weekend = date.getDay() === 0 || date.getDay() === 6
        const events = byDay.get(day) ?? []
        // One dot per calendar, not per event.
        const colors = [...new Set(events.map((event) => event.color))].slice(0, config.maxDots)

        return (
          <button
            key={date.toISOString()}
            type="button"
            className="cal__cell"
            data-outside={outside}
            data-today={day === startOfToday}
            data-selected={interactive && day === selectedDay}
            data-weekend={config.highlightWeekend && weekend}
            onClick={() => onSelect(day)}
            // Nothing to select without calendars, so the grid is not interactive.
            tabIndex={interactive ? 0 : -1}
            aria-label={
              events.length > 0
                ? `${date.toDateString()}, ${events.length} event${events.length === 1 ? '' : 's'}`
                : date.toDateString()
            }
          >
            <span className="cal__num">{date.getDate()}</span>
            {colors.length > 0 ? (
              <span className="cal__dots">
                {colors.map((color) => (
                  <span key={color} className="cal__dot" style={{ background: colorOf(color) }} />
                ))}
              </span>
            ) : null}
          </button>
        )
      })}
    </>
  )
}

// One day drawn against an hour axis, so the shape of the day is visible.
// No day-stepping chevrons: in a view that replaces the month, `‹` would be
// ambiguous between "previous day" and "back to the grid".
function DayView({
  day,
  events,
  locale,
  loading,
  isToday,
  now,
  refreshing,
  onRefresh,
  onBack,
}: {
  day: number
  events: DayEvent[]
  locale?: string
  loading: boolean
  isToday: boolean
  now: number
  refreshing: boolean
  onRefresh: () => void
  onBack: () => void
}) {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(day)
  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })
  const hourLabel = new Intl.DateTimeFormat(locale, { hour: 'numeric' })

  const allDay = events.filter((event) => event.allDay)
  const timed = events.filter((event) => !event.allDay)
  const { start, end } = hourRange(events, day, now)
  const span = (end - start) * HOUR
  // Fixed height per hour rather than squeezing the day into the card, so block
  // heights stay honest; the track scrolls when the day does not fit.
  const trackHeight = `${(end - start) * 3.4}em`
  const axis = []
  for (let hour = start; hour <= end; hour += 1) axis.push(hour)

  /** Where a time falls down the track, as a percentage of the drawn span. */
  const offset = (at: number) => ((at - (day + start * HOUR)) / span) * 100
  const nowAt = isToday && now >= day + start * HOUR && now <= day + end * HOUR ? offset(now) : null

  // A zoomed axis would otherwise open at midnight; scroll to now, else the
  // first event.
  const trackRef = useRef<HTMLDivElement>(null)
  const focus = nowAt ?? (timed.length > 0 ? offset(Math.min(...timed.map((e) => e.start))) : null)
  useEffect(() => {
    const track = trackRef.current
    if (!track || focus === null) return
    const target = (focus / 100) * track.scrollHeight - track.clientHeight / 2
    track.scrollTop = Math.max(0, target)
  }, [focus, day])

  return (
    <div className="cal__day">
      {/* A chevron, since a heading alone does not read as the way back. */}
      <header className="cal__dayhead">
        <button
          type="button"
          className="cal__daynav is-icon-btn"
          onClick={onBack}
          aria-label="Back to the month"
          title="Back to the month"
        >
          <Icon name="chevronLeft" />
        </button>

        <button
          type="button"
          className="cal__daytitle"
          onClick={onBack}
          tabIndex={-1}
          title="Back to the month"
        >
          <span className="cal__dayweekday">{isToday ? 'Today' : weekday}</span>
          <span className="cal__daydate">
            {new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(day)}
          </span>
        </button>

        <button
          type="button"
          className="cal__daynav is-icon-btn"
          onClick={onRefresh}
          aria-label="Check for changes"
          title="Check for changes"
        >
          <Icon name={refreshing ? 'spinner' : 'reset'} spin={refreshing} />
        </button>
      </header>

      {allDay.length > 0 ? (
        <ul className="cal__allday">
          {allDay.map((event) => (
            <li key={event.id} className="cal__alldayitem" title={event.title}>
              <span className="cal__eventbar" style={{ background: colorOf(event.color) }} />
              <span className="cal__eventtitle">{event.title}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {loading ? (
        <p className="cal__dayempty">
          <Icon name="spinner" spin /> Loading
        </p>
      ) : events.length === 0 ? (
        <p className="cal__dayempty">Nothing on.</p>
      ) : (
        <div className="cal__track scroll-y" ref={trackRef}>
          <div className="cal__hours" style={{ height: trackHeight }}>
            {axis.map((hour) => (
              <div
                key={hour}
                className="cal__hour"
                style={{ top: `${((hour - start) / (end - start)) * 100}%` }}
              >
                <span className="cal__hourlabel">
                  {hourLabel.format(new Date(day).setHours(hour, 0, 0, 0))}
                </span>
                <span className="cal__hourline" />
              </div>
            ))}

            {layout(timed).map(({ event, column, columns }) => {
              // Clamped so an event running over midnight stays inside the track.
              const top = Math.max(0, offset(event.start))
              const bottom = Math.min(100, offset(event.end))
              // Lines the block can hold, from its share of the axis rather than
              // the widget's height.
              const hours = ((bottom - top) / 100) * (end - start)
              return (
                <button
                  type="button"
                  key={event.id}
                  className="cal__slot"
                  data-lines={hours < 0.75 ? 'one' : hours < 1.5 ? 'two' : 'many'}
                  data-link={event.url ? true : undefined}
                  disabled={!event.url}
                  onClick={() => event.url && openUrl(event.url)}
                  title={event.url ? `Open ${event.title}` : undefined}
                  style={{
                    top: `${top}%`,
                    // No minimum height: a floor would make a block overrun its
                    // own end time. The axis is zoomed instead - see `hourRange`.
                    height: `${bottom - top}%`,
                    // Shares of the room left of the hour labels; the gutter is
                    // added here rather than as a margin, which would overhang.
                    insetInlineStart: `calc(var(--cal-gutter) + (100% - var(--cal-gutter)) * ${column / columns})`,
                    width: `calc((100% - var(--cal-gutter)) / ${columns} - 3px)`,
                    // Tinted, not filled, so the title stays readable in both themes.
                    ['--slot' as string]: colorOf(event.color),
                  }}
                >
                  <span className="cal__slotdot" />
                  <span className="cal__slottitle">{event.title}</span>
                  {/* Both ends, always: when a thing starts and stops is the
                      detail the block exists to carry. */}
                  <span className="cal__slotwhen">
                    {time.format(event.start)} – {time.format(event.end)}
                  </span>
                  {event.location ? (
                    <span className="cal__slotwhere">{event.location}</span>
                  ) : null}
                </button>
              )
            })}

            {nowAt !== null ? (
              <div className="cal__now" style={{ top: `${nowAt}%` }} aria-hidden="true" />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function GrantNotice({
  calendars,
  onGrant,
}: {
  calendars: LoadedCalendar[]
  onGrant: () => void
}) {
  return (
    <div className="cal__grant">
      <Icon name="warning" />
      <span>{calendars.map((cal) => urlLabel(cal.url)).join(', ')} needs permission.</span>
      <Button onClick={onGrant}>Allow</Button>
    </div>
  )
}

// First-run flow. It spells out where the secret iCal address comes from, since
// nobody finds it by guessing.
function CalendarSetup({
  existing,
  onAdd,
  onCancel,
}: {
  /** Already connected, to colour the new one apart and refuse a repeat. */
  existing: CalendarSource[]
  onAdd: (source: CalendarSource) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    const url = normaliseUrl(draft)
    if (!url) {
      setError('That does not look like a calendar address.')
      return
    }
    if (existing.some((source) => source.url === url)) {
      setError('That calendar is already connected.')
      return
    }
    setBusy(true)
    if (!(await requestCalendarAccess(url))) {
      setBusy(false)
      setError(`Reading ${urlLabel(url)} needs permission for that site.`)
      return
    }
    const probed = await probeCalendar(url)
    setBusy(false)
    if (!probed) {
      setError('Could not read a calendar there. Check the address.')
      return
    }
    // Next colour along; `colorOf` wraps, so this stays in range.
    onAdd({ url, name: probed.name, color: existing.length })
  }

  return (
    <div className="cal cal--setup wframe__live">
      <p className="cal__setuplead">
        {existing.length > 0 ? 'Connect another calendar' : 'Connect a calendar'}
      </p>
      <ol className="cal__steps">
        <li>
          Open{' '}
          <button
            type="button"
            className="cal__link"
            onClick={() => openUrl('https://calendar.google.com/calendar/r/settings', 'newTab')}
          >
            Google Calendar settings
          </button>
          .
        </li>
        <li>
          In the left sidebar, under <em>Settings for my calendars</em>, click the calendar you
          want. The address only exists on a calendar&apos;s own page, not the main settings screen.
        </li>
        <li>
          Scroll down to <em>Integrate calendar</em>.
        </li>
        <li>
          Copy <strong>Secret address in iCal format</strong>; it ends <code>.ics</code>. Take the
          secret one, not the public one; the public address needs the calendar to be public and
          omits event details.
        </li>
        <li>Paste it below. It keeps itself up to date after that; this is a one-off.</li>
      </ol>
      <p className="cal__note">
        <Icon name="lock" /> Treat that address like a password: anyone with it can read the
        calendar. It is kept on this device and only ever sent to Google. <em>Reset</em>, in the
        same <em>Integrate calendar</em> section, revokes it if it ever leaks.
      </p>

      <div className="cal__setuprow">
        <TextInput
          value={draft}
          onChange={setDraft}
          placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
          wide
          type="url"
        />
        <Button
          icon={busy ? 'spinner' : 'add'}
          onClick={() => void add()}
          disabled={busy}
          title="Add this calendar"
        />
      </div>

      {error ? (
        <p className="cal__error">
          <Icon name="warning" /> {error}
        </p>
      ) : null}

      <button type="button" className="cal__skip" onClick={onCancel}>
        Cancel
      </button>
    </div>
  )
}

const HOUR = 3_600_000

// The day's own span rather than a fixed 24 hours, padded an hour each way and
// floored at a few hours.
function hourRange(events: DayEvent[], day: number, now: number): { start: number; end: number } {
  const timed = events.filter((event) => !event.allDay)
  if (timed.length === 0) return { start: 9, end: 17 }

  let first = 24
  let last = 0
  for (const event of timed) {
    first = Math.min(first, Math.max(0, (event.start - day) / HOUR))
    last = Math.max(last, Math.min(24, (event.end - day) / HOUR))
  }

  const nowHour = now >= day && now < day + 24 * HOUR ? (now - day) / HOUR : null
  if (nowHour !== null) {
    first = Math.min(first, nowHour)
    last = Math.max(last, nowHour)
  }

  // Extra hours only cost scrolling; too few would clip an event added later.
  const start = Math.max(0, Math.min(Math.floor(first) - 1, 8))
  const end = Math.min(24, Math.max(Math.ceil(last) + 1, 19))
  return { start, end }
}

// Overlapping events split the width. Columns are assigned greedily over events
// sorted by start.
function layout(events: DayEvent[]): { event: DayEvent; column: number; columns: number }[] {
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end)
  const placed: { event: DayEvent; column: number; columns: number }[] = []
  let cluster: typeof placed = []
  let clusterEnd = -Infinity
  const ends: number[] = []

  const flush = () => {
    const columns = ends.length || 1
    for (const item of cluster) item.columns = columns
    placed.push(...cluster)
    cluster = []
    ends.length = 0
    clusterEnd = -Infinity
  }

  for (const event of sorted) {
    if (event.start >= clusterEnd) flush()
    let column = ends.findIndex((end) => end <= event.start)
    if (column === -1) {
      column = ends.length
      ends.push(event.end)
    } else {
      ends[column] = event.end
    }
    cluster.push({ event, column, columns: 1 })
    clusterEnd = Math.max(clusterEnd, event.end)
  }
  flush()
  return placed
}

interface DayEvent extends CalendarEvent {
  /** Which calendar it came from, for its colour. */
  color: number
}

// Buckets each event into every local day it covers. The end is exclusive, so an
// all-day event ending at midnight stays off the following day.
function groupByDay(calendars: LoadedCalendar[], from: number, to: number): Map<number, DayEvent[]> {
  const byDay = new Map<number, DayEvent[]>()

  for (const calendar of calendars) {
    for (const event of calendar.events) {
      const first = new Date(event.start)
      first.setHours(0, 0, 0, 0)
      const cursor = new Date(first)
      for (let guard = 0; guard < 40; guard += 1) {
        const day = cursor.getTime()
        if (day >= to || day >= event.end) break
        if (day >= from) {
          const list = byDay.get(day) ?? []
          list.push({ ...event, color: calendar.color })
          byDay.set(day, list)
        }
        cursor.setDate(cursor.getDate() + 1)
      }
    }
  }

  for (const list of byDay.values()) {
    list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start)
  }
  return byDay
}

function resolveWeekStart(setting: CalendarConfig['weekStart'], locale?: string): number {
  if (setting === 'monday') return 1
  if (setting === 'sunday') return 0
  if (setting === 'saturday') return 6
  // `weekInfo` is not in every engine's typings yet, hence the narrow cast.
  const info = new Intl.Locale(locale ?? navigator.language) as Intl.Locale & {
    weekInfo?: { firstDay: number }
    getWeekInfo?: () => { firstDay: number }
  }
  const firstDay = info.getWeekInfo?.().firstDay ?? info.weekInfo?.firstDay
  // Intl reports 1..7 (Monday 1); JS wants 0..6 (Sunday 0).
  return firstDay ? firstDay % 7 : 1
}

/** Always six rows, so the widget's height does not change between months. */
function monthCells(view: Date, weekStart: number): Date[][] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1)
  const lead = (first.getDay() - weekStart + 7) % 7
  const start = new Date(first)
  start.setDate(1 - lead)

  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + week * 7 + day)
      return date
    }),
  )
}

function weekdayNames(locale: string | undefined, weekStart: number): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'narrow' })
  return Array.from({ length: 7 }, (_, i) => {
    // 2024-01-07 was a Sunday: a stable anchor for weekday names.
    const date = new Date(2024, 0, 7 + ((weekStart + i) % 7))
    return format.format(date)
  })
}

function isoWeek(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const day = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
}

registerWidget<CalendarConfig>({
  type: 'calendar',
  name: 'Calendar',
  description: 'This month at a glance. Connect a calendar to see your meetings on it.',
  icon: 'calendar',
  configSchema: CalendarConfig,
  // Large and up only: a month is always six rows of seven, which does not fit
  // smaller without dropping the dots and the agenda.
  sizes: ['large', 'xlarge'],
  defaultSize: 'large',
  Component: CalendarWidget,
  fields: [
    {
      label: 'Calendars',
      help: 'Each calendar asks for access to its own site when you add it.',
      control: { kind: 'custom', render: (scope) => <CalendarList scope={scope} />, stacked: true },
      keywords: 'google ical ics subscribe meetings events',
    },
    {
      path: 'weekStart',
      label: 'Week starts',
      control: {
        kind: 'select',
        options: [
          { value: 'auto', label: 'From locale' },
          { value: 'monday', label: 'Monday' },
          { value: 'sunday', label: 'Sunday' },
          { value: 'saturday', label: 'Saturday' },
        ],
      },
    },
    { path: 'showAgenda', label: "Show the day's events", control: { kind: 'toggle' } },
    {
      path: 'maxDots',
      label: 'Dots per day',
      control: { kind: 'slider', min: 1, max: 5 },
      whenLocal: (values) => Array.isArray(values.sources) && values.sources.length > 0,
    },
    { path: 'showWeekNumbers', label: 'Week numbers', control: { kind: 'toggle' } },
    { path: 'showAdjacentMonths', label: 'Show neighbouring days', control: { kind: 'toggle' } },
    { path: 'highlightWeekend', label: 'Highlight weekends', control: { kind: 'toggle' } },
  ],
})
