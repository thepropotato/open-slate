import type { SlatePayload } from './slateCode'

/**
 * Starter arrangements, so a new profile is not a blank grid and a one-clock
 * default. Each is the same shape a shared slate code carries, which is the
 * point: a preset is not a special case the importer has to know about.
 *
 * Every preset stays inside six columns and uses only footprints from
 * `WIDGET_SIZES`, so they tile at the default width without being repacked.
 * Widgets that need an account or an address are left out - a starter layout
 * that opens on four widgets all asking to be set up is worse than an empty one.
 */

export interface SlatePreset extends SlatePayload {
  id: string
  /** What the arrangement is for, shown beside its name in the picker. */
  description: string
}

const base = {
  columns: 6,
  margin: 14,
  compact: 'vertical',
  layout: {},
} as const

export const SLATE_PRESETS: SlatePreset[] = [
  {
    ...base,
    id: 'focus',
    name: 'Focus',
    description: 'A clock, the day ahead, and somewhere to put what you are doing.',
    widgets: [
      { type: 'greeting', surface: null, x: 1, y: 0, w: 4, h: 1 },
      { type: 'clock', surface: null, x: 1, y: 1, w: 2, h: 1 },
      { type: 'timer', surface: null, x: 3, y: 1, w: 2, h: 1 },
      { type: 'todo', surface: null, x: 1, y: 2, w: 2, h: 2 },
      { type: 'notes', surface: null, x: 3, y: 2, w: 2, h: 2 },
    ],
  },
  {
    ...base,
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Clock, weather and calendar across the top, with the day below.',
    widgets: [
      { type: 'clock', surface: null, x: 0, y: 0, w: 2, h: 1 },
      { type: 'weather', surface: null, x: 2, y: 0, w: 2, h: 1 },
      { type: 'timer', surface: null, x: 4, y: 0, w: 2, h: 1 },
      { type: 'calendar', surface: null, x: 0, y: 1, w: 2, h: 2 },
      { type: 'todo', surface: null, x: 2, y: 1, w: 2, h: 2 },
      { type: 'notes', surface: null, x: 4, y: 1, w: 2, h: 2 },
    ],
  },
  {
    ...base,
    id: 'reading',
    name: 'Reading',
    description: 'Where you left off, what is new, and the pages you keep.',
    widgets: [
      { type: 'greeting', surface: null, x: 1, y: 0, w: 4, h: 1 },
      { type: 'continue', surface: null, x: 0, y: 1, w: 2, h: 2 },
      { type: 'feed', surface: null, x: 2, y: 1, w: 2, h: 2 },
      { type: 'bookmarks', surface: null, x: 4, y: 1, w: 2, h: 2 },
    ],
  },
  {
    ...base,
    id: 'minimal',
    name: 'Minimal',
    description: 'A clock and nothing else, for a tab that gets out of the way.',
    widgets: [{ type: 'clock', surface: null, x: 2, y: 0, w: 2, h: 1 }],
  },
]
