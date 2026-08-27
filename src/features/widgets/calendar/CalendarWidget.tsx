import { useState } from 'react'
import { z } from 'zod'
import { Icon } from '@/core/icons'
import { useNow } from '@/core/hooks'
import { useSettings } from '@/core/settings/SettingsProvider'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { resolveLocale } from '@/core/util/time'
import './calendar.css'

const CalendarConfig = z.object({
  /** `auto` takes the first day of the week from the locale. */
  weekStart: z.enum(['auto', 'monday', 'sunday', 'saturday']).default('auto'),
  showWeekNumbers: z.boolean().default(false),
  showAdjacentMonths: z.boolean().default(true),
  highlightWeekend: z.boolean().default(true),
})

type CalendarConfig = z.infer<typeof CalendarConfig>

function CalendarWidget({ config }: WidgetProps<CalendarConfig>) {
  const { behavior } = useSettings()
  const locale = resolveLocale(behavior.locale)
  const today = useNow('minute')
  /** Months away from the current one, so "today" stays correct over midnight. */
  const [offset, setOffset] = useState(0)

  const view = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const weekStart = resolveWeekStart(config.weekStart, locale)
  const cells = monthCells(view, weekStart)

  const dayNames = weekdayNames(locale, weekStart)
  const isToday = (date: Date) => sameDay(date, today)

  return (
    <div className="cal">
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
          onClick={() => setOffset(0)}
          title="Back to this month"
        >
          {new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(view)}
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

      <div className="cal__grid" data-weeks={config.showWeekNumbers}>
        {config.showWeekNumbers ? <span className="cal__wk" /> : null}
        {/* Keyed by index: narrow weekday names repeat (T, T and S, S). */}
        {dayNames.map((name, index) => (
          <span key={index} className="cal__dayname">
            {name}
          </span>
        ))}

        {cells.map((week, index) => (
          <Week
            key={index}
            week={week}
            month={view.getMonth()}
            config={config}
            isToday={isToday}
          />
        ))}
      </div>
    </div>
  )
}

function Week({
  week,
  month,
  config,
  isToday,
}: {
  week: Date[]
  month: number
  config: CalendarConfig
  isToday: (date: Date) => boolean
}) {
  return (
    <>
      {config.showWeekNumbers ? <span className="cal__wk">{isoWeek(week[0])}</span> : null}
      {week.map((date) => {
        const outside = date.getMonth() !== month
        if (outside && !config.showAdjacentMonths) {
          return <span key={date.toISOString()} className="cal__cell" />
        }
        const weekend = date.getDay() === 0 || date.getDay() === 6
        return (
          <span
            key={date.toISOString()}
            className="cal__cell"
            data-outside={outside}
            data-today={isToday(date)}
            data-weekend={config.highlightWeekend && weekend}
          >
            {date.getDate()}
          </span>
        )
      })}
    </>
  )
}

/* ------------------------------------------------------------------- dates */

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

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
      const date = new Date(start)
      date.setDate(start.getDate() + week * 7 + day)
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
  description: 'This month at a glance.',
  icon: 'calendar',
  configSchema: CalendarConfig,
  sizes: ['medium', 'large', 'xlarge'],
  defaultSize: 'large',
  Component: CalendarWidget,
  fields: [
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
    { path: 'showWeekNumbers', label: 'Week numbers', control: { kind: 'toggle' } },
    { path: 'showAdjacentMonths', label: 'Show neighbouring days', control: { kind: 'toggle' } },
    { path: 'highlightWeekend', label: 'Highlight weekends', control: { kind: 'toggle' } },
  ],
})
