/** Time helpers shared by the clock, calendar and greeting widgets. */

export interface TimeParts {
  hours24: number
  hours12: number
  minutes: number
  seconds: number
  meridiem: 'am' | 'pm'
}

/** `formatToParts`, not date arithmetic, so DST boundaries and half-hour offsets are correct. */
export function timeParts(date: Date, timeZone?: string): TimeParts {
  if (!timeZone) {
    const hours24 = date.getHours()
    return {
      hours24,
      hours12: hours24 % 12 === 0 ? 12 : hours24 % 12,
      minutes: date.getMinutes(),
      seconds: date.getSeconds(),
      meridiem: hours24 < 12 ? 'am' : 'pm',
    }
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const read = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0')
  // `hour12: false` can render midnight as 24 in some engines.
  const hours24 = read('hour') % 24
  return {
    hours24,
    hours12: hours24 % 12 === 0 ? 12 : hours24 % 12,
    minutes: read('minute'),
    seconds: read('second'),
    meridiem: hours24 < 12 ? 'am' : 'pm',
  }
}

export const resolveLocale = (override?: string): string | undefined =>
  override?.trim() ? override.trim() : undefined

export function commonTimezones(): string[] {
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone
  const zones = [
    'UTC',
    'America/Los_Angeles',
    'America/Denver',
    'America/Chicago',
    'America/New_York',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Moscow',
    'Africa/Lagos',
    'Africa/Johannesburg',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Pacific/Auckland',
  ]
  return local && !zones.includes(local) ? [local, ...zones] : zones
}
