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
 * on it, and selecting a day lists it; the numbers alone were a wall calendar
 * nobody had written on.
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
  /** Lists the selected day's events under the grid. */
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
        onAdd={(source) => {
          setConfig({ sources: [...config.sources, source] })
          setSetup(false)
        }}
        onCancel={() => setSetup(false)}
      />
    )
  }

  const agenda = byDay.get(selectedDay) ?? []

  return (
    <div className="cal" data-agenda={config.showAgenda && sources.length > 0}>
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
        ) : (
          /* Always a way to connect a calendar, without the widget asking. */
          <button
            type="button"
            className="cal__aux"
            onClick={() => setSetup(true)}
            aria-label="Connect a calendar"
            title="Connect a calendar"
          >
            <Icon name="add" />
          </button>
        )}

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
        <div className="cal__grant">
          <Icon name="warning" />
          <span>{needsPermission.map((cal) => urlLabel(cal.url)).join(', ')} needs permission.</span>
          <Button
            onClick={() =>
              void Promise.all(
                needsPermission.map((cal) => requestCalendarAccess(cal.url)),
              ).then(() => setRevision((n) => n + 1))
            }
          >
            Allow
          </Button>
        </div>
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
                onSelect={setSelected}
                interactive={sources.length > 0}
              />
            ))}
          </div>
        </div>

        {config.showAgenda && sources.length > 0 ? (
          <Agenda day={selectedDay} events={agenda} locale={locale} loading={calendars === null} />
        ) : null}
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

function Agenda({
  day,
  events,
  locale,
  loading,
}: {
  day: number
  events: DayEvent[]
  locale?: string
  loading: boolean
}) {
  const heading = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(day)
  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="cal__agenda">
      <h4 className="cal__agendahead">
        {heading}
        {events.length > 0 ? (
          <span className="cal__agendacount">
            {events.length} event{events.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </h4>
      {loading ? (
        <p className="cal__agendaempty">
          <Icon name="spinner" spin /> Loading
        </p>
      ) : events.length === 0 ? (
        <p className="cal__agendaempty">Nothing on.</p>
      ) : (
        <ul className="cal__events scroll-y">
          {events.map((event) => (
            <li key={event.id} className="cal__event">
              <span className="cal__eventbar" style={{ background: colorOf(event.color) }} />
              <span className="cal__eventwhen">
                {event.allDay ? (
                  <span className="cal__eventallday">All day</span>
                ) : (
                  <>
                    <span>{time.format(event.start)}</span>
                    {/*
                     * The end is only worth a line when it says something the
                     * start does not — a meeting that runs past this day, or one
                     * long enough that its length is the point.
                     */}
                    {event.end - event.start >= 45 * 60_000 ? (
                      <span className="cal__eventend">{time.format(event.end)}</span>
                    ) : null}
                  </>
                )}
              </span>
              <span className="cal__eventtext">
                <span className="cal__eventtitle" title={event.title}>
                  {event.title}
                </span>
                {event.location ? (
                  <span className="cal__eventwhere" title={event.location}>
                    {event.location}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
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
  onAdd,
  onCancel,
}: {
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
    onAdd({ url, name: probed.name, color: 0 })
  }

  return (
    <div className="cal cal--setup wframe__live">
      <p className="cal__setuplead">Connect a calendar</p>
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
