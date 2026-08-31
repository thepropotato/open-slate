import { z } from 'zod'
import { useNow } from '@/core/hooks'
import { useSettings } from '@/core/settings/SettingsProvider'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { commonTimezones, resolveLocale, timeParts } from '@/core/util/time'
import {
  AnalogFace,
  BinaryFace,
  DigitalFace,
  FlipFace,
  MinimalFace,
  MonoFace,
  RingsFace,
  TextFace,
  type FaceProps,
} from './faces'
import './clock.css'

const STYLES = [
  'digital',
  'minimal',
  'mono',
  'flip',
  'text',
  'binary',
  'analog-classic',
  'analog-minimal',
  'analog-bauhaus',
  'rings',
] as const

const ClockConfig = z.object({
  style: z.enum(STYLES).default('digital'),
  hourFormat: z.enum(['auto', '12', '24']).default('auto'),
  showSeconds: z.boolean().default(false),
  showDate: z.boolean().default(true),
  dateStyle: z.enum(['weekday', 'short', 'long', 'numeric']).default('weekday'),
  /** Empty means the browser's own timezone. */
  timezone: z.string().default(''),
  /** Shown under the time when a timezone override is set. */
  label: z.string().default(''),
  align: z.enum(['center', 'flex-start', 'flex-end']).default('center'),
})

type ClockConfig = z.infer<typeof ClockConfig>

function ClockWidget({ config }: WidgetProps<ClockConfig>) {
  const { behavior } = useSettings()
  const now = useNow(config.showSeconds || config.style === 'binary' ? 'second' : 'minute')

  const timezone = config.timezone || behavior.timezone || undefined
  const locale = resolveLocale(behavior.locale)
  const time = timeParts(now, timezone)

  const hour12 =
    config.hourFormat === 'auto' ? prefersTwelveHour(locale) : config.hourFormat === '12'

  const faceProps: FaceProps = { time, showSeconds: config.showSeconds, hour12 }

  return (
    <div className="clock" style={{ ['--clock-align' as string]: config.align }}>
      <Face style={config.style} {...faceProps} />
      {config.showDate ? (
        <span className="clock__date">{formatDate(now, locale, timezone, config.dateStyle)}</span>
      ) : null}
      {config.label || (config.timezone && !config.label) ? (
        <span className="clock__zone">{config.label || zoneLabel(config.timezone)}</span>
      ) : null}
    </div>
  )
}

function Face({ style, ...props }: FaceProps & { style: ClockConfig['style'] }) {
  switch (style) {
    case 'minimal':
      return <MinimalFace {...props} />
    case 'mono':
      return <MonoFace {...props} />
    case 'flip':
      return <FlipFace {...props} />
    case 'text':
      return <TextFace {...props} />
    case 'binary':
      return <BinaryFace {...props} />
    case 'analog-classic':
      return <AnalogFace {...props} variant="classic" />
    case 'analog-minimal':
      return <AnalogFace {...props} variant="minimal" />
    case 'analog-bauhaus':
      return <AnalogFace {...props} variant="bauhaus" />
    case 'rings':
      return <RingsFace {...props} />
    default:
      return <DigitalFace {...props} />
  }
}

// Asks Intl whether this locale writes times with a meridiem.
function prefersTwelveHour(locale?: string): boolean {
  const formatted = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).format(new Date(2020, 0, 1, 13))
  return /\d/.test(formatted) && !/13/.test(formatted)
}

function formatDate(
  date: Date,
  locale: string | undefined,
  timeZone: string | undefined,
  style: ClockConfig['dateStyle'],
): string {
  const options: Intl.DateTimeFormatOptions =
    style === 'weekday'
      ? { weekday: 'long', day: 'numeric', month: 'long' }
      : style === 'short'
        ? { weekday: 'short', day: 'numeric', month: 'short' }
        : style === 'long'
          ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
          : { day: '2-digit', month: '2-digit', year: 'numeric' }
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date)
}

const zoneLabel = (zone: string): string => zone.split('/').pop()?.replace(/_/g, ' ') ?? zone

registerWidget<ClockConfig>({
  type: 'clock',
  name: 'Clock',
  description: 'The time, in one of ten faces: digital, analog, flip, text and more.',
  icon: 'clock',
  configSchema: ClockConfig,
  sizes: ['small', 'medium', 'large', 'wide'],
  defaultSize: 'medium',
  Component: ClockWidget,
  fields: [
    {
      path: 'style',
      label: 'Face',
      control: {
        kind: 'select',
        options: [
          { value: 'digital', label: 'Digital' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'mono', label: 'Monospace' },
          { value: 'flip', label: 'Flip' },
          { value: 'text', label: 'Words' },
          { value: 'binary', label: 'Binary' },
          { value: 'analog-classic', label: 'Analog, classic' },
          { value: 'analog-minimal', label: 'Analog, minimal' },
          { value: 'analog-bauhaus', label: 'Analog, bauhaus' },
          { value: 'rings', label: 'Rings' },
        ],
      },
    },
    {
      path: 'hourFormat',
      label: 'Hours',
      control: {
        kind: 'segmented',
        options: [
          { value: 'auto', label: 'Auto' },
          { value: '12', label: '12' },
          { value: '24', label: '24' },
        ],
      },
      whenLocal: (c) => c.style !== 'text',
    },
    {
      path: 'showSeconds',
      label: 'Seconds',
      control: { kind: 'toggle' },
      whenLocal: (c) => c.style !== 'text',
    },
    { path: 'showDate', label: 'Show the date', control: { kind: 'toggle' } },
    {
      path: 'dateStyle',
      label: 'Date format',
      control: {
        kind: 'select',
        options: [
          { value: 'weekday', label: 'Monday, 3 June' },
          { value: 'short', label: 'Mon, 3 Jun' },
          { value: 'long', label: 'Monday, 3 June 2026' },
          { value: 'numeric', label: '03/06/2026' },
        ],
      },
      whenLocal: (c) => Boolean(c.showDate),
    },
    {
      path: 'timezone',
      label: 'Timezone',
      help: 'Leave on local unless this clock is for somewhere else.',
      control: {
        kind: 'select',
        options: [
          { value: '', label: 'Local' },
          ...commonTimezones().map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') })),
        ],
      },
    },
    {
      path: 'label',
      label: 'Label',
      control: { kind: 'text', placeholder: 'Derived from the timezone' },
    },
    {
      path: 'align',
      label: 'Alignment',
      control: {
        kind: 'segmented',
        options: [
          { value: 'flex-start', label: 'Left' },
          { value: 'center', label: 'Centre' },
          { value: 'flex-end', label: 'Right' },
        ],
      },
    },
  ],
})

export { ClockConfig }
