/**
 * iCalendar (RFC 5545) reading, narrowed to what a month view needs.
 *
 * Hand-written rather than pulled from a library for the same reason the feed
 * parser is: a calendar subscription is a handful of properties, and this page's
 * whole job is to paint instantly. Nothing here is evaluated as code — every
 * value is read as text — and unknown properties are skipped rather than
 * guessed at, so an unfamiliar producer degrades to fewer fields, not a crash.
 */

export interface CalendarEvent {
  id: string
  title: string
  location: string
  /** Where the meeting is, if the feed says. Empty when there is nothing to open. */
  url: string
  /** Epoch ms. For an all-day event, local midnight on the starting day. */
  start: number
  /** Epoch ms, exclusive. All-day events end at local midnight after the last day. */
  end: number
  allDay: boolean
}

/**
 * Undoes RFC 5545 line folding.
 *
 * A folded line continues on the next one, marked by a single leading space or
 * tab. Producers fold at 75 octets, so any long SUMMARY or RRULE arrives split
 * and has to be rejoined before it can be read at all.
 */
function unfold(text: string): string[] {
  const out: string[] = []
  for (const raw of text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')) {
    if (/^[ \t]/.test(raw) && out.length > 0) out[out.length - 1] += raw.slice(1)
    else out.push(raw)
  }
  return out
}

interface Property {
  name: string
  params: Record<string, string>
  value: string
}

/**
 * Splits one content line into name, parameters and value.
 *
 * The colon that ends the name-and-parameters part may also appear inside a
 * quoted parameter value (`DTSTART;TZID="GMT+01:00":...`), so quoting is tracked
 * rather than splitting on the first colon.
 */
function parseLine(line: string): Property | null {
  let colon = -1
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') quoted = !quoted
    else if (char === ':' && !quoted) {
      colon = i
      break
    }
  }
  if (colon === -1) return null

  const head = line.slice(0, colon)
  const value = line.slice(colon + 1)
  const [name, ...rest] = head.split(';')
  const params: Record<string, string> = {}
  for (const part of rest) {
    const equals = part.indexOf('=')
    if (equals === -1) continue
    params[part.slice(0, equals).toUpperCase()] = part.slice(equals + 1).replace(/^"|"$/g, '')
  }
  return { name: name.toUpperCase(), params, value }
}

/** Text values escape commas, semicolons and newlines; backslash is last. */
const unescapeText = (value: string): string =>
  value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')

/**
 * Reads a DATE or DATE-TIME into epoch ms.
 *
 * Three forms exist. A bare `YYYYMMDD` is an all-day date. A `Z` suffix is UTC.
 * Anything else is local — or in the TZID named by the property, which is read
 * as local here, because carrying a full tz database for a month grid costs more
 * than it is worth. That is only wrong for a calendar being read from a
 * different zone than it was written in, and then only by the offset.
 */
function parseDate(value: string, params: Record<string, string>): { at: number; allDay: boolean } | null {
  const date = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim())
  if (!date) return null
  const [, y, m, d, hh, mm, ss, utc] = date
  const allDay = params.VALUE === 'DATE' || hh === undefined

  if (allDay) return { at: new Date(+y, +m - 1, +d).getTime(), allDay: true }
  if (utc) return { at: Date.UTC(+y, +m - 1, +d, +hh!, +mm!, +ss!), allDay: false }
  return { at: new Date(+y, +m - 1, +d, +hh!, +mm!, +ss!).getTime(), allDay: false }
}

/** `PT1H30M`, `P2D` and friends, in ms. Only what DURATION can legally hold. */
function parseDuration(value: string): number {
  const match = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    value.trim(),
  )
  if (!match) return 0
  const [, sign, w, d, h, m, s] = match
  const ms =
    (+(w ?? 0) * 604_800 + +(d ?? 0) * 86_400 + +(h ?? 0) * 3_600 + +(m ?? 0) * 60 + +(s ?? 0)) * 1000
  return sign === '-' ? -ms : ms
}

/**
 * The first http(s) link in a block of text.
 *
 * Conference links are rarely in the URL property — Meet, Zoom and Teams all
 * write them into the description among a paragraph of joining instructions, so
 * the link has to be picked out of prose. Only http and https are accepted:
 * these values come off the network, and anything else (`javascript:` above all)
 * has no business being handed to the browser to open.
 */
function firstLink(text: string): string {
  const match = /https?:\/\/[^\s<>"')\]]+/i.exec(text)
  if (!match) return ''
  // Trailing punctuation belongs to the sentence, not the address.
  return match[0].replace(/[.,;:]+$/, '')
}

interface RawEvent {
  uid: string
  title: string
  location: string
  url: string
  start: number
  end: number
  allDay: boolean
  rrule: string
  exdates: number[]
  /** Set on an event that overrides one occurrence of a recurring series. */
  recurrenceId: number | null
  cancelled: boolean
}

/**
 * Pulls the VEVENT blocks out of an ICS document.
 *
 * VTIMEZONE and VALARM blocks also contain DTSTART, so nesting depth is tracked
 * rather than reading properties wherever they appear.
 */
function readEvents(text: string): RawEvent[] {
  const events: RawEvent[] = []
  let current: RawEvent | null = null
  let depth = 0

  for (const line of unfold(text)) {
    const property = parseLine(line)
    if (!property) continue
    const { name, params, value } = property

    if (name === 'BEGIN' && value.toUpperCase() === 'VEVENT') {
      current = {
        uid: '',
        title: '',
        location: '',
        url: '',
        start: NaN,
        end: NaN,
        allDay: false,
        rrule: '',
        exdates: [],
        recurrenceId: null,
        cancelled: false,
      }
      depth = 0
      continue
    }
    if (!current) continue

    if (name === 'BEGIN') {
      depth += 1
      continue
    }
    if (name === 'END') {
      if (depth > 0) depth -= 1
      else {
        if (Number.isFinite(current.start)) events.push(current)
        current = null
      }
      continue
    }
    // Inside a VALARM: its own DTSTART/DURATION describe the reminder, not the event.
    if (depth > 0) continue

    switch (name) {
      case 'UID':
        current.uid = value
        break
      case 'SUMMARY':
        current.title = unescapeText(value)
        break
      case 'LOCATION':
        current.location = unescapeText(value)
        break
      /*
       * A URL property is the event's own link, so it wins. Otherwise the join
       * link is usually buried in the description — Meet, Zoom and Teams all
       * write it there — and the location field sometimes holds it too.
       */
      case 'URL':
        if (!current.url) current.url = firstLink(value)
        break
      case 'DESCRIPTION':
      case 'X-GOOGLE-CONFERENCE': {
        const link = firstLink(unescapeText(value))
        if (link && !current.url) current.url = link
        break
      }
      case 'STATUS':
        current.cancelled = value.toUpperCase() === 'CANCELLED'
        break
      case 'DTSTART': {
        const parsed = parseDate(value, params)
        if (parsed) {
          current.start = parsed.at
          current.allDay = parsed.allDay
        }
        break
      }
      case 'DTEND': {
        const parsed = parseDate(value, params)
        if (parsed) current.end = parsed.at
        break
      }
      case 'DURATION':
        if (!Number.isFinite(current.end) && Number.isFinite(current.start)) {
          current.end = current.start + parseDuration(value)
        }
        break
      case 'RRULE':
        current.rrule = value
        break
      case 'EXDATE':
        for (const part of value.split(',')) {
          const parsed = parseDate(part, params)
          if (parsed) current.exdates.push(parsed.at)
        }
        break
      case 'RECURRENCE-ID': {
        const parsed = parseDate(value, params)
        if (parsed) current.recurrenceId = parsed.at
        break
      }
    }
  }

  return events
}

const DAY_MS = 86_400_000
const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/**
 * Expands an RRULE across a window.
 *
 * Covers the rules a personal calendar actually produces — daily, weekly with
 * BYDAY, monthly by date and yearly — plus COUNT and UNTIL. Anything more exotic
 * (BYSETPOS, BYWEEKNO) falls back to the single starting occurrence, which shows
 * the event once instead of dropping it silently.
 *
 * Each step is taken from the original start with calendar arithmetic rather
 * than by adding a fixed number of milliseconds, so a monthly event stays on its
 * date and a daily one stays at its clock time across a DST change.
 */
function expand(event: RawEvent, length: number, from: number, to: number): number[] {
  if (!event.rrule) return event.start < to && event.start + length > from ? [event.start] : []

  const rule: Record<string, string> = {}
  for (const part of event.rrule.split(';')) {
    const equals = part.indexOf('=')
    if (equals > 0) rule[part.slice(0, equals).toUpperCase()] = part.slice(equals + 1)
  }

  const freq = (rule.FREQ ?? '').toUpperCase()
  const interval = Math.max(1, Number(rule.INTERVAL ?? 1) || 1)
  const count = rule.COUNT ? Number(rule.COUNT) : Infinity
  const until = rule.UNTIL ? (parseDate(rule.UNTIL, {})?.at ?? Infinity) : Infinity
  const byDay = rule.BYDAY
    ? rule.BYDAY.split(',')
        .map((day) => WEEKDAYS.indexOf(day.trim().slice(-2).toUpperCase()))
        .filter((day) => day >= 0)
    : []

  if (!['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq)) {
    return event.start < to && event.start + length > from ? [event.start] : []
  }

  const origin = new Date(event.start)
  const skipped = new Set(event.exdates)
  const out: number[] = []
  /*
   * Bounded two ways: by the window, and by a hard cap. A malformed or
   * unbounded rule must not be able to spin here on a page that has to paint
   * immediately, and no month view needs more than a few hundred occurrences.
   */
  const LIMIT = 750

  for (let step = 0, made = 0; step < LIMIT && made < count; step += 1) {
    let occurrence: Date

    if (freq === 'DAILY') {
      occurrence = new Date(origin)
      occurrence.setDate(origin.getDate() + step * interval)
    } else if (freq === 'WEEKLY') {
      // BYDAY turns one week into several occurrences, so a week is one step and
      // the days inside it are emitted together.
      const weekStart = new Date(origin)
      weekStart.setDate(origin.getDate() + step * interval * 7)
      const days = byDay.length > 0 ? byDay : [origin.getDay()]
      let past = false
      for (const day of days.slice().sort((a, b) => a - b)) {
        const at = new Date(weekStart)
        at.setDate(weekStart.getDate() + ((day - origin.getDay() + 7) % 7))
        const time = at.getTime()
        if (time < event.start || time > until) {
          if (time > until) past = true
          continue
        }
        if (made >= count) break
        made += 1
        if (time >= from - DAY_MS && time < to && !skipped.has(time)) out.push(time)
      }
      if (past || weekStart.getTime() >= to) break
      continue
    } else if (freq === 'MONTHLY') {
      occurrence = new Date(origin)
      occurrence.setMonth(origin.getMonth() + step * interval)
      // A 31st in a 30-day month rolls into the next one; RFC 5545 skips it.
      if (occurrence.getDate() !== origin.getDate()) continue
    } else {
      occurrence = new Date(origin)
      occurrence.setFullYear(origin.getFullYear() + step * interval)
      if (occurrence.getDate() !== origin.getDate()) continue
    }

    const time = occurrence.getTime()
    if (time > until) break
    made += 1
    if (time >= to) break
    if (time >= from - DAY_MS && !skipped.has(time)) out.push(time)
  }

  return out
}

/**
 * How long an event lasts.
 *
 * DTEND and DURATION are both optional. RFC 5545 says an event with neither
 * lasts one day if it is all-day and is instantaneous otherwise; an hour is used
 * for the timed case instead, because a zero-width event is invisible in a list
 * and every real producer means "a meeting whose end was not stated".
 */
function durationOf(event: RawEvent): number {
  if (Number.isFinite(event.end)) return Math.max(0, event.end - event.start)
  return event.allDay ? DAY_MS : 3_600_000
}

/**
 * Every occurrence overlapping `[from, to)`, ready to render.
 *
 * A VEVENT carrying RECURRENCE-ID replaces that one occurrence of its series —
 * the moved instance of a weekly meeting — so those are collected first and the
 * matching generated occurrence is dropped.
 */
export function parseCalendar(text: string, from: number, to: number): CalendarEvent[] {
  const raw = readEvents(text).filter((event) => !event.cancelled)
  const overrides = new Map<string, RawEvent>()
  for (const event of raw) {
    if (event.recurrenceId !== null) overrides.set(`${event.uid}:${event.recurrenceId}`, event)
  }

  const out: CalendarEvent[] = []

  for (const event of raw) {
    if (event.recurrenceId !== null) continue

    const length = durationOf(event)

    for (const start of expand(event, length, from, to)) {
      const override = overrides.get(`${event.uid}:${start}`)
      const at = override ?? { ...event, start, end: start + length }
      const end = override ? override.start + durationOf(override) : start + length
      if (at.start >= to || end <= from) continue
      out.push({
        id: `${event.uid || at.title}:${at.start}`,
        title: at.title || 'Busy',
        location: at.location,
        url: at.url,
        start: at.start,
        // A zero-length event still has to occupy its own day in the grid.
        end: Math.max(end, at.start + 1),
        allDay: at.allDay,
      })
    }
  }

  // Overrides landing outside their series' generated set (a meeting moved into
  // this month from another) would otherwise never be shown.
  for (const override of overrides.values()) {
    const end = override.start + durationOf(override)
    if (override.start >= to || end <= from) continue
    if (out.some((event) => event.start === override.start && event.title === override.title)) continue
    out.push({
      id: `${override.uid}:${override.start}:moved`,
      title: override.title || 'Busy',
      location: override.location,
      url: override.url,
      start: override.start,
      end: Math.max(end, override.start + 1),
      allDay: override.allDay,
    })
  }

  return out.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title))
}

/** The calendar's own name, for labelling a subscription the user just added. */
export function calendarName(text: string): string {
  for (const line of unfold(text)) {
    const property = parseLine(line)
    if (!property) continue
    if (property.name === 'X-WR-CALNAME' || property.name === 'NAME') {
      return unescapeText(property.value)
    }
    if (property.name === 'BEGIN' && property.value.toUpperCase() === 'VEVENT') break
  }
  return ''
}
