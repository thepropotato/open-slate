/**
 * Shorthand typed into the add field.
 *
 * The point of the tasks widget is that adding something takes one line and one
 * Enter. Priority and due dates would ordinarily cost a form, so instead they
 * are read out of the text as you type it: `!` marks priority, `@` marks a due
 * date. Both are stripped from the saved title, and anything that does not
 * parse is left alone as ordinary words — `email @ 9` is a task called
 * "email @ 9", not a broken date.
 *
 * Pure and dependency-free so `npm test` can cover it.
 */

/** 0 is unset; 1 is the most urgent so lists sort ascending. */
export type Priority = 0 | 1 | 2 | 3

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: 'No priority',
  1: 'High',
  2: 'Medium',
  3: 'Low',
}

export const PRIORITY_SHORT: Record<Priority, string> = { 0: '', 1: 'P1', 2: 'P2', 3: 'P3' }

export interface ParsedDraft {
  text: string
  priority: Priority
  /** Epoch ms of local midnight on the due day, or 0 for none. */
  due: number
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** Local midnight, the resolution every due date is stored at. */
export const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

export const addDays = (from: number, days: number): number => {
  const date = new Date(from)
  date.setDate(date.getDate() + days)
  return startOfDay(date)
}

/** Whole days from today to a due day; negative is overdue. */
export const daysUntil = (due: number, today: number): number =>
  Math.round((due - today) / 86_400_000)

/**
 * Reads one `@`-phrase. Returns null when the words are not a date, which is
 * what keeps an ordinary `@` in a task title from being eaten.
 */
export function parseDue(phrase: string, today: number): number | null {
  const raw = phrase.trim().toLowerCase()
  if (!raw) return null

  if (raw === 'today' || raw === 'tod') return today
  if (raw === 'tomorrow' || raw === 'tom' || raw === 'tmr') return addDays(today, 1)
  if (raw === 'yesterday') return addDays(today, -1)

  // `3d`, `2w`, `1m` — a span from today.
  const span = /^(\d{1,3})\s*(d|day|days|w|week|weeks|m|month|months)$/.exec(raw)
  if (span) {
    const count = Number(span[1])
    const unit = span[2][0]
    if (unit === 'd') return addDays(today, count)
    if (unit === 'w') return addDays(today, count * 7)
    const date = new Date(today)
    date.setMonth(date.getMonth() + count)
    return startOfDay(date)
  }

  // A weekday name means the next one, and `next friday` the week after that.
  const weekday = /^(next\s+)?([a-z]{3,9})$/.exec(raw)
  if (weekday) {
    const index = WEEKDAYS.findIndex((day) => day.startsWith(weekday[2]) && weekday[2].length >= 3)
    if (index >= 0) {
      const current = new Date(today).getDay()
      // Naming today's weekday means next week's, never zero days away.
      const ahead = (index - current + 7) % 7 || 7
      return addDays(today, ahead + (weekday[1] ? 7 : 0))
    }
  }

  // `25/12`, `25-12-2026`, `12.25` — day first, matching the rest of the app's
  // day/month ordering, with the year assumed to be the next occurrence.
  const numeric = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(raw)
  if (numeric) {
    const day = Number(numeric[1])
    const month = Number(numeric[2])
    if (day < 1 || day > 31 || month < 1 || month > 12) return null
    const now = new Date(today)
    let year = numeric[3] ? Number(numeric[3]) : now.getFullYear()
    if (year < 100) year += 2000
    const build = (y: number) => new Date(y, month - 1, day)
    let date = build(year)
    if (date.getMonth() !== month - 1) return null
    if (!numeric[3] && date.getTime() < today) date = build(year + 1)
    return startOfDay(date)
  }

  return null
}

/**
 * Splits a typed line into a title, a priority and a due date.
 *
 * `enabled` mirrors the widget's own toggles: with a feature off its marker is
 * just text, so turning priorities off does not silently swallow a `!`.
 */
export function parseDraft(
  input: string,
  today: number,
  enabled: { priorities: boolean; dueDates: boolean } = { priorities: true, dueDates: true },
): ParsedDraft {
  let text = input
  let priority: Priority = 0
  let due = 0

  if (enabled.dueDates) {
    /*
     * `@` may lead the line or sit anywhere in it, and the space after it is
     * optional — `@today hello` and `finish it @ friday` are both natural to
     * type. The phrase is taken greedily and then shortened a word at a time
     * until something parses, which is what lets `@ next friday` win two words
     * while `@ today hello` takes only one and leaves "hello" as the title.
     */
    const at = /(^|\s)@\s*([^@]+)$/.exec(text)
    if (at) {
      const words = at[2].trim().split(/\s+/)
      for (let take = Math.min(words.length, 3); take > 0; take -= 1) {
        const parsed = parseDue(words.slice(0, take).join(' '), today)
        if (parsed === null) continue
        due = parsed
        const rest = words.slice(take).join(' ')
        text = `${text.slice(0, at.index)} ${rest}`
        break
      }
    }
  }

  if (enabled.priorities) {
    // `!!` is medium, `!!!` low, and a bare `!` high — fewer marks, more urgent.
    const bang = /(?:^|\s)(!{1,3})(?=\s|$)/.exec(text)
    if (bang) {
      priority = bang[1].length as Priority
      text = text.slice(0, bang.index) + text.slice(bang.index + bang[0].length)
    }
    const named = /(?:^|\s)(?:p|P)([1-3])(?=\s|$)/.exec(text)
    if (!bang && named) {
      priority = Number(named[1]) as Priority
      text = text.slice(0, named.index) + text.slice(named.index + named[0].length)
    }
  }

  return { text: text.replace(/\s+/g, ' ').trim(), priority, due }
}

/** How a due date reads in a row: relative when it is near, a date when it is not. */
export function dueLabel(due: number, today: number, locale?: string): string {
  const days = daysUntil(due, today)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days < 0 && days > -7) return `${-days} days ago`
  if (days > 1 && days < 7) {
    return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(due))
  }
  const sameYear = new Date(due).getFullYear() === new Date(today).getFullYear()
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  }).format(new Date(due))
}

/**
 * Ordering for the list.
 *
 * Done always sinks, whatever the key — the live list belongs at eye level.
 * Within each half the chosen key applies, and unset values sort last, so
 * turning on due-date sorting over a half-dated list does not bury the tasks
 * that actually carry a date behind the ones that do not. `manual` keeps the
 * order things were added in.
 */
export function sortItems<T extends { done: boolean; priority: number; due: number }>(
  items: readonly T[],
  sortBy: 'manual' | 'priority' | 'due',
): T[] {
  const last = (value: number) => (value > 0 ? value : Infinity)
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return Number(a.done) - Number(b.done)
    if (sortBy === 'priority') return last(a.priority) - last(b.priority)
    if (sortBy === 'due') return last(a.due) - last(b.due)
    return 0
  })
}

/* ----------------------------------------------------------------- filters */

/**
 * What the list is showing.
 *
 * Every facet is a set of the values it admits, and empty means "no opinion" —
 * so the default, all sets empty, shows everything and the widget starts
 * unfiltered. That is what lets the facets combine freely: picking P1 and P2
 * while picking overdue and today asks for exactly the four-way intersection,
 * with no precedence rules to learn.
 */
export interface TaskFilter {
  /** `active` and `done`. Empty shows both. */
  status: Status[]
  /** Priorities admitted, 0 meaning "none set". Empty admits any. */
  priority: Priority[]
  /** Date buckets admitted. Empty admits any. */
  due: DueBucket[]
  /** Case-insensitive substring of the task text. */
  text: string
}

export type Status = 'active' | 'done'
export type DueBucket = 'overdue' | 'today' | 'week' | 'later' | 'none'

export const EMPTY_FILTER: TaskFilter = { status: [], priority: [], due: [], text: '' }

export const STATUS_LABELS: Record<Status, string> = {
  active: 'Active',
  done: 'Completed',
}

export const DUE_LABELS: Record<DueBucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  week: 'This week',
  later: 'Later',
  none: 'No date',
}

/** Which date bucket a task falls in. The buckets tile the whole timeline. */
export function dueBucket(due: number, today: number): DueBucket {
  if (due <= 0) return 'none'
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  return daysUntil(due, today) <= 7 ? 'week' : 'later'
}

/** True when no facet is narrowing anything, so the list is showing everything. */
export const isFilterEmpty = (filter: TaskFilter): boolean =>
  filter.status.length === 0 &&
  filter.priority.length === 0 &&
  filter.due.length === 0 &&
  filter.text.trim() === ''

/** How many facets are narrowing the list, for the badge on the filter button. */
export const activeFacetCount = (filter: TaskFilter): number =>
  (filter.status.length > 0 ? 1 : 0) +
  (filter.priority.length > 0 ? 1 : 0) +
  (filter.due.length > 0 ? 1 : 0) +
  (filter.text.trim() !== '' ? 1 : 0)

/**
 * Whether one task survives the filter.
 *
 * Facets are ANDed and the values within a facet are ORed — the arrangement
 * people expect from every faceted list, and the one that makes "P1 or P2, due
 * overdue or today" expressible without a query language.
 */
export function matchesFilter(
  item: { done: boolean; priority: number; due: number; text: string },
  filter: TaskFilter,
  today: number,
): boolean {
  if (filter.status.length > 0) {
    const status: Status = item.done ? 'done' : 'active'
    if (!filter.status.includes(status)) return false
  }
  if (filter.priority.length > 0 && !filter.priority.includes(item.priority as Priority)) {
    return false
  }
  if (filter.due.length > 0 && !filter.due.includes(dueBucket(item.due, today))) return false

  const needle = filter.text.trim().toLowerCase()
  if (needle && !item.text.toLowerCase().includes(needle)) return false
  return true
}

/** Adds or removes one value from a facet, which is how every checkbox writes. */
export function toggleFacet<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value]
}
