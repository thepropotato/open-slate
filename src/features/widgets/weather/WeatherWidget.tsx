import { useState } from 'react'
import { z } from 'zod'
import { Icon } from '@/core/icons'
import { useAsyncValue } from '@/core/hooks'
import { Button, TextInput } from '@/core/ui'
import { useSettings } from '@/core/settings/SettingsProvider'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { resolveLocale } from '@/core/util/time'
import {
  WEATHER_ORIGINS,
  fetchWeather,
  locate,
  requestWeatherAccess,
  searchPlaces,
  type Place,
} from './api'
import { weatherLook } from './codes'
import './weather.css'

const WeatherConfig = z.object({
  /** Empty name means "not configured yet". */
  place: z
    .object({
      name: z.string().default(''),
      country: z.string().default(''),
      admin: z.string().default(''),
      latitude: z.number().default(0),
      longitude: z.number().default(0),
    })
    .prefault({}),
  units: z.enum(['metric', 'imperial']).default('metric'),
  detail: z.enum(['compact', 'hourly', 'daily']).default('daily'),
  showFeelsLike: z.boolean().default(true),
  showWind: z.boolean().default(true),
  showHumidity: z.boolean().default(false),
})

type WeatherConfig = z.infer<typeof WeatherConfig>

function WeatherWidget({ config, setConfig }: WidgetProps<WeatherConfig>) {
  const { behavior } = useSettings()
  const locale = resolveLocale(behavior.locale)
  const configured = Boolean(config.place.name)

  const weather = useAsyncValue(
    configured ? `weather:${config.place.latitude},${config.place.longitude},${config.units}` : null,
    () => fetchWeather(config.place as Place, config.units),
  )

  if (!configured) {
    return <PlaceSetup onPick={(place) => setConfig({ place })} />
  }

  if (!weather) {
    return (
      <div className="weather weather--empty">
        <Icon name="spinner" spin />
        <span>Fetching {config.place.name}</span>
      </div>
    )
  }

  const look = weatherLook(weather.current.code, weather.current.isDay)
  const degrees = config.units === 'metric' ? 'C' : 'F'
  const speed = config.units === 'metric' ? 'km/h' : 'mph'

  return (
    <div className="weather" data-detail={config.detail}>
      <div className="weather__now">
        <Icon name={look.icon} className="weather__icon" />
        <div className="weather__reading">
          <span className="weather__temp">
            {Math.round(weather.current.temperature)}
            <span className="weather__unit">{degrees}</span>
          </span>
          <span className="weather__label">{look.label}</span>
        </div>
        <div className="weather__meta">
          <span className="weather__place" title={weather.place}>
            {weather.place.split(',')[0]}
          </span>
          {config.showFeelsLike ? (
            <span>Feels {Math.round(weather.current.apparent)}&deg;</span>
          ) : null}
          {config.showWind ? (
            <span>
              <Icon name="wind" /> {Math.round(weather.current.windSpeed)} {speed}
            </span>
          ) : null}
          {config.showHumidity ? (
            <span>
              <Icon name="humidity" /> {Math.round(weather.current.humidity)}%
            </span>
          ) : null}
        </div>
      </div>

      {config.detail === 'hourly' ? (
        <ul className="weather__strip">
          {weather.hourly.slice(0, 12).map((hour) => {
            const hourLook = weatherLook(hour.code, true)
            return (
              <li key={hour.time}>
                <span className="weather__striptime">
                  {new Intl.DateTimeFormat(locale, { hour: 'numeric' }).format(new Date(hour.time))}
                </span>
                <Icon name={hourLook.icon} />
                <span className="weather__striptemp">{Math.round(hour.temperature)}&deg;</span>
              </li>
            )
          })}
        </ul>
      ) : null}

      {config.detail === 'daily' ? (
        <ul className="weather__strip">
          {weather.daily.slice(0, 7).map((day) => {
            const dayLook = weatherLook(day.code, true)
            return (
              <li key={day.date}>
                <span className="weather__striptime">
                  {new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(
                    // Parsed as a local date, so the weekday is not shifted by UTC.
                    new Date(`${day.date}T12:00:00`),
                  )}
                </span>
                <Icon name={dayLook.icon} />
                <span className="weather__striptemp">
                  {Math.round(day.max)}&deg;
                  <span className="weather__stripmin">{Math.round(day.min)}&deg;</span>
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

/** First-run flow: ask for host access, then a place. */
function PlaceSetup({ onPick }: { onPick: (place: WeatherConfig['place']) => void }) {
  const [query, setQuery] = useState('')
  const [granted, setGranted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  const results = useAsyncValue(granted !== false && query.trim().length > 1 ? `geo:${query}` : null, () =>
    searchPlaces(query),
  )

  const grant = async () => {
    setBusy(true)
    const ok = await requestWeatherAccess()
    setGranted(ok)
    setBusy(false)
  }

  const pickCurrentLocation = async () => {
    setBusy(true)
    const place = await locate()
    setBusy(false)
    if (place) onPick({ ...place, admin: '' })
  }

  return (
    <div className="weather weather--setup">
      {granted === false ? (
        <p className="weather__hint">
          <Icon name="warning" /> Weather needs access to {WEATHER_ORIGINS[0]}.
        </p>
      ) : null}

      <div className="weather__setuprow">
        <TextInput
          value={query}
          onChange={setQuery}
          placeholder="Town or city"
          wide
          type="search"
        />
        <Button icon="location" onClick={() => void pickCurrentLocation()} title="Use my location" />
      </div>

      {granted === null ? (
        <Button icon={busy ? 'spinner' : 'check'} onClick={() => void grant()} disabled={busy}>
          Allow weather data
        </Button>
      ) : null}

      {results?.length ? (
        <ul className="weather__places">
          {results.map((place) => (
            <li key={`${place.latitude},${place.longitude}`}>
              <button
                type="button"
                onClick={() =>
                  onPick({
                    name: place.name,
                    country: place.country,
                    admin: place.admin ?? '',
                    latitude: place.latitude,
                    longitude: place.longitude,
                  })
                }
              >
                <span>{place.name}</span>
                <span className="weather__placemeta">
                  {[place.admin, place.country].filter(Boolean).join(', ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

registerWidget<WeatherConfig>({
  type: 'weather',
  name: 'Weather',
  description: 'Current conditions and a forecast, from Open-Meteo. No account needed.',
  icon: 'weather',
  configSchema: WeatherConfig,
  defaultSize: { w: 8, h: 4 },
  minSize: { w: 4, h: 2 },
  origins: WEATHER_ORIGINS,
  Component: WeatherWidget,
  fields: [
    {
      path: 'units',
      label: 'Units',
      control: {
        kind: 'segmented',
        options: [
          { value: 'metric', label: 'Celsius' },
          { value: 'imperial', label: 'Fahrenheit' },
        ],
      },
    },
    {
      path: 'detail',
      label: 'Forecast',
      control: {
        kind: 'segmented',
        options: [
          { value: 'compact', label: 'None' },
          { value: 'hourly', label: 'Hourly' },
          { value: 'daily', label: 'Daily' },
        ],
      },
    },
    { path: 'showFeelsLike', label: 'Show feels-like', control: { kind: 'toggle' } },
    { path: 'showWind', label: 'Show wind', control: { kind: 'toggle' } },
    { path: 'showHumidity', label: 'Show humidity', control: { kind: 'toggle' } },
    {
      path: 'place.name',
      label: 'Place',
      help: 'Clear this to pick a different location.',
      control: { kind: 'text', placeholder: 'Not set' },
    },
  ],
})
