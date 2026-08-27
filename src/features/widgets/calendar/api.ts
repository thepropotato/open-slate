import { localStore, permissions } from '@/core/platform/browser'
import { parseCalendar, calendarName, type CalendarEvent } from './ics'

/**
 * Calendar subscriptions, over plain iCalendar feeds.
 *
 * A feed URL is all this needs — Google Calendar's "Secret address in iCal
 * format", or the equivalent from Outlook, Apple, Fastmail or any CalDAV
 * server. That choice is deliberate: OAuth would mean shipping a client secret
 * inside an extension anyone can unpack, an account link to revoke, and a
 * Google-only widget. A subscription URL is read-only by construction, works
 * with every provider, and can be withdrawn by regenerating it.
 *
 * Access is granted per calendar origin when the calendar is added, so the
 * extension never holds blanket network permission, and results are cached
 * because a new tab may open many times between two calendar changes.
 */

const CACHE_KEY = 'calendarCache'
/*
 * The feed is a live subscription: each fetch returns the calendar as it stands
 * now, so adding a URL is a one-time setup that keeps itself current. This TTL
 * only stops ten tabs opening at once from becoming ten requests — a meeting
 * added elsewhere shows up on the first new tab after it lapses, and `refresh`
 * below skips it entirely.
 */
const CACHE_TTL_MS = 5 * 60 * 1000

export interface CalendarSource {
  url: string
  name: string
  /** Index into the palette below, so each calendar keeps its colour. */
  color: number
}

interface CacheEntry {
  at: number
  name: string
  /** The raw feed, so a window change re-expands without re-fetching. */
  ics: string
}

/** Distinct hues that hold up against any accent and in both themes. */
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

/**
 * Normalises what a user is likely to paste.
 *
 * Google hands out the secret address as a `webcal://` link from some surfaces
 * and `https://` from others, and both are the same document over HTTPS.
 */
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
  /** Set when the calendar could not be read, for showing why. */
  error?: string
}

/** A short label for a calendar URL, used before its real name is known. */
export function urlLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Fetches a calendar and reports what its feed calls itself.
 *
 * Used when adding a subscription, so the list can show "Work" rather than the
 * hundred-character secret URL the user pasted.
 */
export async function probeCalendar(url: string): Promise<{ name: string } | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const text = await response.text()
    if (!/BEGIN:VCALENDAR/i.test(text)) return null
    return { name: calendarName(text) || urlLabel(url) }
  } catch {
    return null
  }
}

/** Every event across the given calendars overlapping `[from, to)`. */
export async function loadCalendars(
  sources: CalendarSource[],
  from: number,
  to: number,
  /** Skips the cache, for an explicit "check again" from the user. */
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

/** Drops a calendar's cached copy, so removing it leaves nothing behind. */
export async function forgetCalendar(url: string): Promise<void> {
  const cache = (await localStore.get<Record<string, CacheEntry>>(CACHE_KEY)) ?? {}
  if (!(url in cache)) return
  delete cache[url]
  await localStore.set(CACHE_KEY, cache)
}
