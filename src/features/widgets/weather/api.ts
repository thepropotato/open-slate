import { localStore, permissions } from '@/core/platform/browser'

/**
 * Open-Meteo client.
 *
 * Chosen because it needs no API key and no account, which means no credential
 * to ship in the extension and nothing tying a request to a user. Responses are
 * cached in storage so opening ten tabs is one request, not ten.
 */

export const WEATHER_ORIGINS = ['https://*.open-meteo.com/*']

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
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

/** Browser geolocation, behind the optional `geolocation` permission. */
export async function locate(): Promise<Place | null> {
  if (!('geolocation' in navigator)) return null
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          name: 'Current location',
          country: '',
          latitude: Number(position.coords.latitude.toFixed(3)),
          longitude: Number(position.coords.longitude.toFixed(3)),
        }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 30 * 60 * 1000 },
    )
  })
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
