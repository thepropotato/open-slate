import { localStore, permissions } from '@/core/platform/browser'
import { parseCalendar, calendarName, type CalendarEvent } from './ics'

// Calendar subscriptions over plain iCalendar feed URLs rather than OAuth: no
// client secret to ship in an unpackable extension, read-only by construction,
// and provider-agnostic. Host access is granted per calendar origin.

const CACHE_KEY = 'calendarCache'
// Only stops a burst of new tabs becoming a burst of requests; `refresh` skips it.
const CACHE_TTL_MS = 5 * 60 * 1000

export interface CalendarSource {
  url: string
  name: string
  /** Index into the palette below. */
  color: number
}

interface CacheEntry {
  at: number
  name: string
  /** Raw feed, so a window change re-expands without re-fetching. */
  ics: string
}

export const CALENDAR_COLORS = [
  '#4285f4',
  '#e8710a',
  '#0b8043',
  '#d50000',
  '#8e24aa',
  '#039be5',
  '#f6bf26',
  '#7986cb',
]

export const colorOf = (index: number): string =>
  CALENDAR_COLORS[((index % CALENDAR_COLORS.length) + CALENDAR_COLORS.length) % CALENDAR_COLORS.length]

// Google hands out the same address as `webcal://` or `https://`; both are the
// same document over HTTPS.
export function normaliseUrl(input: string): string {
  const value = input.trim()
  if (!value) return ''
  const withScheme = /^webcal:\/\//i.test(value)
    ? `https://${value.slice('webcal://'.length)}`
    : /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`
  return originOf(withScheme) ? withScheme : ''
}

export const originOf = (url: string): string | null => {
  try {
    const parsed = new URL(url)
    if (!/^https?:$/.test(parsed.protocol)) return null
    return `${parsed.origin}/*`
  } catch {
    return null
  }
}

export const hasCalendarAccess = (url: string): Promise<boolean> => {
  const origin = originOf(url)
  return origin ? permissions.has([], [origin]) : Promise.resolve(false)
}

export const requestCalendarAccess = (url: string): Promise<boolean> => {
  const origin = originOf(url)
  return origin ? permissions.request([], [origin]) : Promise.resolve(false)
}

export interface LoadedCalendar {
  url: string
  name: string
  color: number
  events: CalendarEvent[]
  /** Set when the calendar could not be read. */
  error?: string
}

export function urlLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Why a probe failed, in the words the reader needs to act on. */
export type ProbeFailure = 'private' | 'missing' | 'unreachable' | 'not-a-calendar'

export interface ProbeResult {
  name?: string
  failure?: ProbeFailure
}

// Fetches a calendar for its own name, so a new subscription shows "Work"
// rather than the pasted secret URL. A failure carries its reason: "check the
// address" is wrong advice for a work calendar whose address is perfectly
// correct and merely refused to an extension.
export async function probeCalendar(url: string): Promise<ProbeResult> {
  let response: Response
  try {
    response = await fetch(url)
  } catch {
    return { failure: 'unreachable' }
  }
  // A calendar behind a sign-in answers the request rather than the calendar:
  // 401/403 outright, and Google redirects a Workspace feed to a login page that
  // is a perfectly good 200 of HTML.
  if (response.status === 401 || response.status === 403) return { failure: 'private' }
  if (response.status === 404) return { failure: 'missing' }
  if (!response.ok) return { failure: 'unreachable' }

  const text = await response.text()
  if (!/BEGIN:VCALENDAR/i.test(text)) {
    return { failure: /<html/i.test(text) ? 'private' : 'not-a-calendar' }
  }
  return { name: calendarName(text) || urlLabel(url) }
}

/** What to tell the reader about a failed probe. */
export function probeMessage(failure: ProbeFailure, url: string): string {
  const host = urlLabel(url)
  switch (failure) {
    case 'private':
      return `${host} asked for a sign-in instead of a calendar. Copy the calendar's secret address in iCal format, not the one from your browser's address bar. Some work accounts have that sharing turned off by an administrator.`
    case 'missing':
      return 'There is no calendar at that address. It may have been reset - copy the secret address again.'
    case 'not-a-calendar':
      return 'That address answered with something that is not a calendar.'
    case 'unreachable':
      return `Could not reach ${host}.`
  }
}

/**
 * Whether a calendar arrived with its details hidden. Sharing a calendar as
 * "free/busy only" strips every title, location and join link before it leaves
 * the server, so the widget has nothing to show and no amount of re-reading will
 * change that - it is worth saying so rather than looking broken.
 */
export function isFreeBusyOnly(calendar: LoadedCalendar): boolean {
  return calendar.events.length > 0 && calendar.events.every((event) => event.untitled)
}

/** Every event across the given calendars overlapping `[from, to)`. */
export async function loadCalendars(
  sources: CalendarSource[],
  from: number,
  to: number,
  /** Skips the cache. */
  refresh = false,
): Promise<LoadedCalendar[]> {
  const cache = (await localStore.get<Record<string, CacheEntry>>(CACHE_KEY)) ?? {}
  const results: LoadedCalendar[] = []
  let cacheChanged = false

  for (const source of sources) {
    const hit = cache[source.url]
    const fresh = !refresh && hit && Date.now() - hit.at < CACHE_TTL_MS

    const read = (ics: string, name: string, error?: string): LoadedCalendar => ({
      url: source.url,
      name: source.name || name || urlLabel(source.url),
      color: source.color,
      events: ics ? parseCalendar(ics, from, to) : [],
      error,
    })

    if (fresh) {
      results.push(read(hit.ics, hit.name))
      continue
    }

    if (!(await hasCalendarAccess(source.url))) {
      results.push(read(hit?.ics ?? '', hit?.name ?? '', 'needs-permission'))
      continue
    }

    try {
      const response = await fetch(source.url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const ics = await response.text()
      if (!/BEGIN:VCALENDAR/i.test(ics)) throw new Error('not a calendar')
      cache[source.url] = { at: Date.now(), name: calendarName(ics), ics }
      cacheChanged = true
      results.push(read(ics, cache[source.url].name))
    } catch (error) {
      // A stale copy beats an empty calendar when the network is down.
      results.push(
        read(
          hit?.ics ?? '',
          hit?.name ?? '',
          error instanceof Error ? error.message : 'could not load',
        ),
      )
    }
  }

  if (cacheChanged) await localStore.set(CACHE_KEY, cache)
  return results
}

export async function forgetCalendar(url: string): Promise<void> {
  const cache = (await localStore.get<Record<string, CacheEntry>>(CACHE_KEY)) ?? {}
  if (!(url in cache)) return
  delete cache[url]
  await localStore.set(CACHE_KEY, cache)
}
