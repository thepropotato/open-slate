import type { IconName } from '@/core/icons'

// WMO weather interpretation codes from Open-Meteo, grouped so near-identical
// codes share one icon.
export interface WeatherLook {
  label: string
  icon: IconName
  /** Used at night, where the day icon implies sunshine. */
  nightIcon?: IconName
}

const looks: Array<{ codes: number[]; look: WeatherLook }> = [
  { codes: [0], look: { label: 'Clear', icon: 'weatherClear', nightIcon: 'weatherClearNight' } },
  { codes: [1], look: { label: 'Mostly clear', icon: 'weatherClear', nightIcon: 'weatherClearNight' } },
  { codes: [2], look: { label: 'Partly cloudy', icon: 'weatherPartly', nightIcon: 'weatherPartlyNight' } },
  { codes: [3], look: { label: 'Overcast', icon: 'weather' } },
  { codes: [45, 48], look: { label: 'Fog', icon: 'weatherFog' } },
  { codes: [51, 53, 55, 56, 57], look: { label: 'Drizzle', icon: 'weatherRain' } },
  { codes: [61, 63, 66], look: { label: 'Rain', icon: 'weatherRain' } },
  { codes: [65, 67, 80, 81, 82], look: { label: 'Heavy rain', icon: 'weatherHeavyRain' } },
  { codes: [71, 73, 75, 77, 85, 86], look: { label: 'Snow', icon: 'weatherSnow' } },
  { codes: [95, 96, 99], look: { label: 'Thunderstorm', icon: 'weatherStorm' } },
]

const byCode = new Map<number, WeatherLook>()
for (const entry of looks) {
  for (const code of entry.codes) byCode.set(code, entry.look)
}

export function weatherLook(code: number, isDay: boolean): WeatherLook {
  const look = byCode.get(code) ?? { label: 'Unknown', icon: 'weather' as IconName }
  if (!isDay && look.nightIcon) return { ...look, icon: look.nightIcon }
  return look
}
