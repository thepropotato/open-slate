import { localStore, permissions } from '@/core/platform/browser'

/**
 * Open-Meteo client.
 *
 * Chosen because it needs no API key and no account, which means no credential
 * to ship in the extension and nothing tying a request to a user. Responses are
 * cached in storage so opening ten tabs is one request, not ten.
 */

/*
 * Both hosts are granted together: auto-detection is part of the first run, so
 * splitting them would mean two prompts to get one working widget.
 */
export const WEATHER_ORIGINS = [
  'https://*.open-meteo.com/*',
  'https://get.geojs.io/*',
  'https://ipwho.is/*',
]

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
/*
 * Two providers because both are free and unauthenticated, which means both are
 * allowed to rate-limit or disappear. Whichever answers first wins; the shapes
 * differ, so each gets its own reader.
 */
const IP_LOOKUPS = [
  { url: 'https://get.geojs.io/v1/ip/geo.json', read: readGeojs },
  { url: 'https://ipwho.is/', read: readIpwho },
]
const CACHE_KEY = 'weatherCache'
const CACHE_TTL_MS = 20 * 60 * 1000

export interface Place {
  name: string
  country: string
  admin?: string
  latitude: number
  longitude: number
  timezone?: string
}

export interface Conditions {
  temperature: number
  apparent: number
  humidity: number
  windSpeed: number
  code: number
  isDay: boolean
  /** Local time of the reading, for showing staleness. */
  observedAt: number
}

export interface DayForecast {
  date: string
  code: number
  min: number
  max: number
  precipitationChance: number
}

export interface HourForecast {
  time: string
  temperature: number
  code: number
  precipitationChance: number
}

export interface Weather {
  place: string
  units: 'metric' | 'imperial'
  current: Conditions
  hourly: HourForecast[]
  daily: DayForecast[]
}

interface CacheEntry {
  at: number
  value: Weather
}

export const hasWeatherAccess = (): Promise<boolean> => permissions.has([], WEATHER_ORIGINS)

export const requestWeatherAccess = (): Promise<boolean> => permissions.request([], WEATHER_ORIGINS)

export async function fetchWeather(
  place: Place,
  units: 'metric' | 'imperial',
): Promise<Weather | null> {
  const cacheKey = `${place.latitude.toFixed(2)},${place.longitude.toFixed(2)},${units}`
  const cache = (await localStore.get<Record<string, CacheEntry>>(CACHE_KEY)) ?? {}
  const hit = cache[cacheKey]
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,weather_code,precipitation_probability',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    forecast_days: '7',
    timezone: 'auto',
  })
  if (units === 'imperial') {
    params.set('temperature_unit', 'fahrenheit')
    params.set('wind_speed_unit', 'mph')
  }

  try {
    const response = await fetch(`${FORECAST_URL}?${params}`)
    if (!response.ok) return hit?.value ?? null
    const data = (await response.json()) as OpenMeteoResponse
    const value = shape(place, units, data)
    await localStore.set(CACHE_KEY, { ...cache, [cacheKey]: { at: Date.now(), value } })
    return value
  } catch {
    // Offline, or the host permission was revoked. A stale reading beats nothing.
    return hit?.value ?? null
  }
}

export async function searchPlaces(query: string): Promise<Place[]> {
  const term = query.trim()
  if (term.length < 2) return []
  try {
    const response = await fetch(`${GEOCODE_URL}?name=${encodeURIComponent(term)}&count=8`)
    if (!response.ok) return []
    const data = (await response.json()) as { results?: GeocodeResult[] }
    return (data.results ?? []).map((result) => ({
      name: result.name,
      country: result.country ?? '',
      admin: result.admin1,
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone,
    }))
  } catch {
    return []
  }
}

/**
 * Where the widget places itself, with no prompt and no click.
 *
 * Deliberately never touches `navigator.geolocation`. The object exists on an
 * extension page and `permissions.query` can even report it as granted from the
 * browser-level setting, but the call still fails unless the manifest declares
 * `geolocation` — and Chrome refuses to make that optional, so declaring it
 * would put a "know your physical location" warning in front of every install
 * for one widget. Calling it anyway is what logs Chrome's
 * "Is the 'geolocation' permission appropriate?" warning to the console.
 *
 * So: an IP lookup, city-level, which is all a forecast needs; then the
 * browser's own timezone geocoded by its city name, which needs no host beyond
 * the one the forecast already uses. Null means both failed and the caller asks
 * for a town by hand.
 */
export async function autoLocate(): Promise<Place | null> {
  return (await locateByIp()) ?? (await locateByTimezone())
}

/** City-level, from whoever is serving the request. No prompt, no precision. */
async function locateByIp(): Promise<Place | null> {
  for (const provider of IP_LOOKUPS) {
    try {
      const response = await fetch(provider.url)
      if (!response.ok) continue
      const place = provider.read(await response.json())
      if (place) return place
    } catch {
      // Blocked, offline or rate-limited: try the next one.
    }
  }
  return null
}

/** GeoJS sends coordinates as strings, and names its country field `country`. */
function readGeojs(body: unknown): Place | null {
  const data = body as {
    city?: string
    region?: string
    country?: string
    latitude?: string
    longitude?: string
    timezone?: string
  }
  return toPlace({
    city: data.city,
    region: data.region,
    country: data.country,
    latitude: Number(data.latitude),
    longitude: Number(data.longitude),
    timezone: data.timezone,
  })
}

/** ipwho.is reports failure as `success: false` on a 200. */
function readIpwho(body: unknown): Place | null {
  const data = body as {
    success?: boolean
    city?: string
    region?: string
    country?: string
    latitude?: number
    longitude?: number
    timezone?: { id?: string }
  }
  if (data.success === false) return null
  return toPlace({
    city: data.city,
    region: data.region,
    country: data.country,
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone?.id,
  })
}

function toPlace(parts: {
  city?: string
  region?: string
  country?: string
  latitude?: number
  longitude?: number
  timezone?: string
}): Place | null {
  const { latitude, longitude } = parts
  // 0,0 is in the Atlantic: a provider that could not place the IP, not a place.
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (latitude === 0 && longitude === 0) return null
  return {
    name: parts.city || parts.region || parts.country || 'Current location',
    country: parts.country ?? '',
    admin: parts.region ?? '',
    latitude: Number(latitude!.toFixed(3)),
    longitude: Number(longitude!.toFixed(3)),
    timezone: parts.timezone,
  }
}

/**
 * Last resort: `Asia/Kolkata` → "Kolkata" → the geocoder we already talk to.
 * Lands on the zone's anchor city, which can be a long way off, but a nearby
 * city's weather beats an empty widget.
 */
async function locateByTimezone(): Promise<Place | null> {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const city = zone?.split('/').pop()?.replace(/_/g, ' ')
    if (!city) return null
    const [match] = await searchPlaces(city)
    return match ?? null
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ shaping */

interface OpenMeteoResponse {
  current?: Record<string, number>
  hourly?: { time: string[]; temperature_2m: number[]; weather_code: number[]; precipitation_probability: number[] }
  daily?: {
    time: string[]
    weather_code: number[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_probability_max: number[]
  }
}

interface GeocodeResult {
  name: string
  country?: string
  admin1?: string
  latitude: number
  longitude: number
  timezone?: string
}

function shape(place: Place, units: 'metric' | 'imperial', data: OpenMeteoResponse): Weather {
  const current = data.current ?? {}
  const now = Date.now()

  const hourly: HourForecast[] = []
  if (data.hourly) {
    for (let i = 0; i < data.hourly.time.length; i += 1) {
      // Only hours still ahead of us are useful.
      if (new Date(data.hourly.time[i]).getTime() < now - 30 * 60 * 1000) continue
      hourly.push({
        time: data.hourly.time[i],
        temperature: data.hourly.temperature_2m[i],
        code: data.hourly.weather_code[i],
        precipitationChance: data.hourly.precipitation_probability?.[i] ?? 0,
      })
      if (hourly.length >= 24) break
    }
  }

  const daily: DayForecast[] = (data.daily?.time ?? []).map((date, i) => ({
    date,
    code: data.daily!.weather_code[i],
    min: data.daily!.temperature_2m_min[i],
    max: data.daily!.temperature_2m_max[i],
    precipitationChance: data.daily!.precipitation_probability_max?.[i] ?? 0,
  }))

  return {
    place: [place.name, place.admin, place.country].filter(Boolean).join(', '),
    units,
    current: {
      temperature: current.temperature_2m ?? 0,
      apparent: current.apparent_temperature ?? current.temperature_2m ?? 0,
      humidity: current.relative_humidity_2m ?? 0,
      windSpeed: current.wind_speed_10m ?? 0,
      code: current.weather_code ?? 0,
      isDay: current.is_day !== 0,
      observedAt: now,
    },
    hourly,
    daily,
  }
}
