import { useState } from 'react'
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

/**
 * A month grid that shows what is actually on.
 *
 * Subscriptions are plain iCalendar feeds — see `api.ts` for why that is the
 * connection rather than OAuth. A day carries a dot per calendar with something
 * on it, and the numbers alone were a wall calendar nobody had written on.
 *
 * Once a calendar is connected the widget is two views rather than one card
 * split in half: it opens on today's events, and the month is where you go to
 * pick a different day. Splitting a small card between a grid and a list gave
 * neither enough room — the grid squeezed to a few rows, the list to one line.
 * Whole-card views mean whichever you are looking at gets all of it.
 */

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
  /** Subscribed calendars. Empty means the widget is still just a month grid. */
  sources: z.array(CalendarSourceSchema).default([]),
  /*
   * Whether the day view exists at all. Off, the widget is only ever the month
   * grid — dates stop opening a day, and a connected widget opens on the month.
   */
  showAgenda: z.boolean().default(true),
  maxDots: z.number().min(1).max(5).default(3),
})

type CalendarConfig = z.infer<typeof CalendarConfig>

function CalendarWidget({ config, setConfig }: WidgetProps<CalendarConfig>) {
  const { behavior } = useSettings()
  const locale = resolveLocale(behavior.locale)
  const today = useNow('minute')
  /** Months away from the current one, so "today" stays correct over midnight. */
  const [offset, setOffset] = useState(0)
  /** Epoch ms of local midnight on the selected day; null means today. */
  const [selected, setSelected] = useState<number | null>(null)
  /*
   * Which of the two views is up. Connected widgets open on `day` — the point
   * of connecting is to see what is on, and a grid of dots makes you click
   * before it tells you anything.
   */
  const [pane, setPane] = useState<'month' | 'day'>('day')
  /** Bumped to re-fetch past the cache when the user asks for it. */
  const [revision, setRevision] = useState(0)
  /** Reopens the setup card over an already-configured widget. */
  const [setup, setSetup] = useState(false)

  const view = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const weekStart = resolveWeekStart(config.weekStart, locale)
  const cells = monthCells(view, weekStart)

  // The whole visible grid, not just the month, so events on the leading and
  // trailing days are fetched too.
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
  /*
   * Today is already the strongest mark on the grid, so it does not also wear a
   * selection ring just for being the default. The ring appears once the user
   * has actually chosen a day.
   */
  const showSelection = selected !== null && selected !== startOfToday
  const needsPermission = (calendars ?? []).filter((cal) => cal.error === 'needs-permission')

  /*
   * The month grid is the widget's face, always — a new tab should show the
   * dates, not a form. Connecting a calendar is an upgrade the `+` in the
   * header offers to anyone looking for it, never something the widget opens
   * with unasked.
   */
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

  /*
   * The day pane needs a calendar to have something to show, and the agenda
   * setting still turns it off. Without either, the widget is the month grid it
   * has always been.
   */
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

        {/*
         * Connecting stays offered after the first calendar. Subscribing to one
         * is rarely subscribing to all of them — work, then a shared family
         * calendar — and hiding `+` the moment one existed left the second
         * findable only through the widget's options dialog.
         *
         * Refresh joins it rather than replacing it, so neither action has to
         * wait for the other to go away.
         */}
        {sources.length > 0 ? (
          <button
            type="button"
            className="cal__aux"
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
          className="cal__add"
          onClick={() => setSetup(true)}
          aria-label="Connect a calendar"
          title="Connect a calendar"
        >
          <Icon name="add" />
        </button>

        <button
          type="button"
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
                  // Picking a date is asking what is on it, so go and show it.
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
        // One dot per calendar, not per event: five meetings on one Tuesday is
        // one busy day, and five identical dots said nothing extra.
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
            // Nothing to select when there are no calendars, so the grid stays
            // a plain read rather than pretending to be interactive.
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

/**
 * The whole card, for one day, drawn against an hour axis.
 *
 * A list said what was on; a timeline says what the day is shaped like — a free
 * afternoon looks free, and a stacked morning looks stacked. That is the thing
 * a glance at a new tab is actually asking.
 *
 * There are deliberately no chevrons here. In a view that replaces the month, a
 * `‹` cannot say whether it steps back a day or back to the grid, and a control
 * that could mean either is worse than one fewer control. Tapping the date is
 * the way back, and it says so.
 */
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
  const axis = []
  for (let hour = start; hour <= end; hour += 1) axis.push(hour)

  /** Where a time falls down the track, as a percentage of the drawn span. */
  const offset = (at: number) => ((at - (day + start * HOUR)) / span) * 100
  const nowAt = isToday && now >= day + start * HOUR && now <= day + end * HOUR ? offset(now) : null

  return (
    <div className="cal__day">
      {/*
       * A chevron, not just a tappable date. The date alone was the way back
       * and nothing said so — a heading does not look like a control, so the
       * way out of the view went unfound.
       */}
      <header className="cal__dayhead">
        <button
          type="button"
          className="cal__daynav"
          onClick={onBack}
          aria-label="Back to the month"
          title="Back to the month"
        >
          <Icon name="chevronLeft" />
        </button>

        {/* Still a target itself, so the whole heading works as the way back. */}
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
          className="cal__daynav"
          onClick={onRefresh}
          aria-label="Check for changes"
          title="Check for changes"
        >
          <Icon name={refreshing ? 'spinner' : 'reset'} spin={refreshing} />
        </button>
      </header>

      {/* All-day events have no place on an hour axis, so they sit above it. */}
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
        <div className="cal__track scroll-y">
          <div className="cal__hours">
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
              // Clamped to the drawn range so an event running over midnight
              // stays inside the track instead of overflowing it.
              const top = Math.max(0, offset(event.start))
              const bottom = Math.min(100, offset(event.end))
              return (
                <div
                  key={event.id}
                  className="cal__slot"
                  style={{
                    top: `${top}%`,
                    // A floor, so a 15-minute event is still a readable block.
                    height: `max(1.5em, ${bottom - top}%)`,
                    /*
                     * Offset and width are shares of the room left of the hour
                     * labels, so a block can never overhang the track — the
                     * gutter is added once here rather than as a margin, which
                     * would push the block out by its own width.
                     */
                    insetInlineStart: `calc(var(--cal-gutter) + (100% - var(--cal-gutter)) * ${column / columns})`,
                    width: `calc((100% - var(--cal-gutter)) / ${columns} - 3px)`,
                    // Tints the block with its calendar rather than filling it,
                    // so the title stays readable in either theme.
                    ['--slot' as string]: colorOf(event.color),
                  }}
                  title={`${time.format(event.start)} ${event.title}`}
                >
                  <span className="cal__slottitle">{event.title}</span>
                  <span className="cal__slotwhen">{time.format(event.start)}</span>
                </div>
              )
            })}

            {/* Where the day has got to — the one live thing on the card. */}
            {nowAt !== null ? (
              <div className="cal__now" style={{ top: `${nowAt}%` }} aria-hidden="true" />
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

/** Shown in either pane: a feed cannot be read until the user allows its host. */
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

/**
 * First-run flow, shown in place of the grid until a calendar is added.
 *
 * Deliberately explains where the address comes from: the secret iCal URL is
 * not something anyone finds by guessing, and the widget is worth far less
 * without one.
 */
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
    /*
     * The next colour along, so a second calendar is told apart from the first
     * at a glance. `colorOf` wraps, so this stays in range however many are on.
     */
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
          Copy <strong>Secret address in iCal format</strong> — it ends <code>.ics</code>. Take the
          secret one, not the public one; the public address needs the calendar to be public and
          omits event details.
        </li>
        <li>Paste it below. It keeps itself up to date after that — this is a one-off.</li>
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

/* ---------------------------------------------------------------- timeline */

const HOUR = 3_600_000

/**
 * The hours the timeline draws, fitted to what is actually on.
 *
 * A fixed 24-hour axis spends most of a card on hours nobody has anything in —
 * a day with one 11:30 meeting would be a sliver of event above and below a
 * screenful of empty night. So the range is the day's own span, padded by an
 * hour each way to give the first and last events somewhere to sit, and floored
 * at a few hours so a single short meeting does not fill the card end to end.
 */
function hourRange(events: DayEvent[], day: number, now: number): { start: number; end: number } {
  const timed = events.filter((event) => !event.allDay)
  // Nothing timed: show the working part of the day rather than an empty axis.
  if (timed.length === 0) return { start: 9, end: 17 }

  let first = 24
  let last = 0
  for (const event of timed) {
    // Clamped to the day: a multi-day event runs past both of its edges.
    first = Math.min(first, Math.max(0, (event.start - day) / HOUR))
    last = Math.max(last, Math.min(24, (event.end - day) / HOUR))
  }

  // The "now" line only reads as a position if its hour is on the axis.
  const nowHour = now >= day && now < day + 24 * HOUR ? (now - day) / HOUR : null
  if (nowHour !== null) {
    first = Math.min(first, nowHour)
    last = Math.max(last, nowHour)
  }

  let start = Math.max(0, Math.floor(first) - 1)
  let end = Math.min(24, Math.ceil(last) + 1)
  // A floor, so one 30-minute meeting does not become a full-height block.
  while (end - start < 5) {
    if (end < 24) end += 1
    else if (start > 0) start -= 1
    else break
  }
  return { start, end }
}

/**
 * Lays overlapping events out side by side.
 *
 * Two meetings at the same hour drawn on top of each other hide one of them, so
 * a run of events that overlap splits the width between them. Columns are
 * assigned greedily over events sorted by start, which is enough for the handful
 * a day holds and keeps the order left-to-right by start time.
 */
function layout(events: DayEvent[]): { event: DayEvent; column: number; columns: number }[] {
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end)
  const placed: { event: DayEvent; column: number; columns: number }[] = []
  /* Events that overlap each other, laid out together so they share a width. */
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

/* ------------------------------------------------------------------ events */

interface DayEvent extends CalendarEvent {
  /** Which calendar it came from, for its colour. */
  color: number
}

/**
 * Buckets every event into the local days it covers.
 *
 * A multi-day event appears on each of its days, so a week away is a run across
 * the grid rather than a mark on the Monday. The end is exclusive, which is what
 * keeps an all-day event ending at midnight off the following day.
 */
function groupByDay(calendars: LoadedCalendar[], from: number, to: number): Map<number, DayEvent[]> {
  const byDay = new Map<number, DayEvent[]>()

  for (const calendar of calendars) {
    for (const event of calendar.events) {
      const first = new Date(event.start)
      first.setHours(0, 0, 0, 0)
      const cursor = new Date(first)
      // Bounded by the grid: a year-long event must not walk 365 iterations.
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
    // All-day items first, then by clock time, so a day reads top to bottom.
    list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start)
  }
  return byDay
}

/* ------------------------------------------------------------------- dates */

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
  // Intl reports 1..7 with Monday as 1 and Sunday as 7; JS wants 0..6, Sunday 0.
  return firstDay ? firstDay % 7 : 1
}

/** Six rows always, so the widget does not change height between months. */
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
    // 2024-01-07 was a Sunday, giving a stable anchor for weekday names.
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
  /*
   * Large and up only. A month is six rows of seven squares whatever else it
   * shows, and at one cell tall that left days about as tall as their own
   * numbers — the dots had to be dropped and the agenda hidden to make it fit
   * at all. A size that can only be shown by removing what the widget is for
   * is not a size worth offering.
   */
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
