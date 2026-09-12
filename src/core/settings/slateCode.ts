import { z } from 'zod'
import { GridItem, Settings, WidgetInstance, type Settings as SettingsType } from './schema'
import { fromBase64Url, toBase64Url } from './themeCode'

/**
 * Shareable slate codes: the arrangement a theme code deliberately leaves out.
 *
 * A theme carries the look. A slate carries where things sit - which widgets are
 * on the grid, at what size, and the layout knobs that frame them.
 *
 * What it never carries is content, and that is the whole design rather than an
 * omission. Widget config holds the secret iCal address of somebody's work
 * calendar, a Spotify client ID, the city they live in; tiles are a list of the
 * sites they visit. A code is pasted into a chat message by people who will not
 * audit it first, so none of that goes in: a shared slate places a calendar
 * widget, and the person who imports it points it at their own calendar.
 */

const PREFIX = 'ns1.'

/** The one piece of instance state worth carrying: it is a frame, not content. */
const SlateWidget = z.object({
  type: WidgetInstance.shape.type,
  surface: WidgetInstance.shape.surface,
  // Grid cell, less the id - ids are minted fresh on import.
  x: GridItem.shape.x,
  y: GridItem.shape.y,
  w: GridItem.shape.w,
  h: GridItem.shape.h,
})

const SlatePayload = z.object({
  /** Shown before the code is applied, so nothing lands unannounced. */
  name: z.string().default(''),
  widgets: z.array(SlateWidget).default([]),
  columns: z.number().default(6),
  margin: z.number().default(14),
  compact: z.string().default('vertical'),
  /** Layout knobs only; `lastPane` is a record of what you did, not a design. */
  layout: z.record(z.string(), z.unknown()).default({}),
})

export type SlatePayload = z.infer<typeof SlatePayload>

export function encodeSlate(settings: SettingsType, name = ''): string {
  const cells = new Map(settings.widgets.layout.map((cell) => [cell.i, cell]))
  const payload: SlatePayload = {
    name,
    widgets: settings.widgets.instances.map((instance) => {
      const cell = cells.get(instance.id)
      return {
        type: instance.type,
        surface: instance.surface,
        x: cell?.x ?? 0,
        y: cell?.y ?? 0,
        w: cell?.w ?? 2,
        h: cell?.h ?? 1,
      }
    }),
    columns: settings.widgets.columns,
    margin: settings.widgets.margin,
    compact: settings.widgets.compact,
    layout: { ...settings.layout, lastPane: undefined },
  }
  return PREFIX + toBase64Url(JSON.stringify(payload))
}

/** Reads a code without applying it, so the reader can be told what they are about to get. */
export function decodeSlate(code: string): SlatePayload {
  const trimmed = code.trim()
  if (!trimmed.startsWith(PREFIX)) throw new Error('That is not a slate code.')
  let raw: unknown
  try {
    raw = JSON.parse(fromBase64Url(trimmed.slice(PREFIX.length)))
  } catch {
    throw new Error('That slate code is damaged.')
  }
  const parsed = SlatePayload.safeParse(raw)
  if (!parsed.success) throw new Error('That slate code contains values this version cannot use.')
  return parsed.data
}

/**
 * A preset is applied through the same path as a pasted code, not beside it.
 * Re-parsed rather than stringified as given: callers pass richer objects (a
 * preset carries an id and a description for the picker), and those fields have
 * no business travelling inside a code that is already labelled by its entry.
 */
export function encodePayload(payload: SlatePayload): string {
  return PREFIX + toBase64Url(JSON.stringify(SlatePayload.parse(payload)))
}

/**
 * Replaces the arrangement, leaving every tile, note and widget setting alone.
 * Widgets are rebuilt from scratch rather than matched to what is already there:
 * a slate describes a whole grid, and half of one merged into half of another is
 * an arrangement nobody designed.
 */
export function applySlate(
  settings: SettingsType,
  code: string,
  mintId: () => string,
  /** Which widget types this build actually has; unknown ones are dropped. */
  isKnownType: (type: string) => boolean = () => true,
): SettingsType {
  const payload = decodeSlate(code)

  // A slate written by a newer build, or one naming a widget since removed, would
  // otherwise leave a hole on the grid that cannot be selected or deleted.
  const known = payload.widgets.filter((widget) => isKnownType(widget.type))

  const instances = known.map((widget) => ({
    id: mintId(),
    type: widget.type,
    // Left at the widget's own defaults: a slate carries no config to restore.
    config: {},
    surface: widget.surface,
  }))

  const layout = instances.map((instance, index) => ({
    i: instance.id,
    x: known[index].x,
    y: known[index].y,
    w: known[index].w,
    h: known[index].h,
  }))

  const merged = {
    ...settings,
    widgets: {
      ...settings.widgets,
      instances,
      layout,
      columns: payload.columns,
      margin: payload.margin,
      compact: payload.compact,
    },
    layout: { ...settings.layout, ...payload.layout, lastPane: settings.layout.lastPane },
  }

  const parsed = Settings.safeParse(merged)
  if (!parsed.success) throw new Error('That slate code contains values this version cannot use.')
  return parsed.data
}

const REPO = 'https://github.com/thepropotato/open-slate'

/** The gallery of shared layouts. Linked, never fetched. */
export const GALLERY_URL = 'https://openslate.byvenu.com/slates'

/**
 * Where "Share this layout" sends you: the submission form, prefilled.
 *
 * An extension cannot open a pull request on someone's behalf - that needs a
 * token, and an unpackable extension has nowhere to keep one. It does not need
 * to. The code is built here and handed to GitHub as a prefilled issue, so the
 * submission is posted by the person making it, under their own account, after
 * they have read it. Nothing is sent anywhere until they press the button on
 * GitHub's own page.
 */
export function submissionUrl(
  settings: SettingsType,
  name = '',
  description = '',
  /** What the author would rather be credited as; their username is used if empty. */
  credit = '',
): string {
  const params = new URLSearchParams({
    template: 'slate-submission.yml',
    labels: 'slate',
    title: name ? `Slate: ${name}` : 'Slate: ',
    name,
    description,
    credit,
    code: encodeSlate(settings),
  })
  return `${REPO}/issues/new?${params.toString()}`
}

/** The Web Store listing id, which is the id an installed copy runs under. */
export const STORE_ID = 'kbacclgoobafnkifgckaenacaeghfonm'

/**
 * A link that opens the slate preview inside the extension.
 *
 * This is what lets the gallery live entirely on the website without the
 * extension fetching anything: the slate travels in the URL, so following a link
 * is a navigation rather than a request, and the site needs no access to the
 * browser. Nothing is applied on arrival - the page shows the result first.
 *
 * The id is the published one. An unpacked build has a different, machine-local
 * id, so a link built here will not open that copy; that is a development
 * concern rather than a shipped one, and the page reads the same URL under any
 * id it is served from.
 */
export function previewUrl(code: string, name = '', by = '', id: string = STORE_ID): string {
  const params = new URLSearchParams({ code })
  if (name) params.set('name', name)
  if (by) params.set('by', by)
  return `chrome-extension://${id}/slate.html?${params.toString()}`
}

export interface SlateCell {
  type: string
  /** 1-based grid lines, ready for `grid-column` / `grid-row`. */
  column: number
  row: number
  spanX: number
  spanY: number
}

/**
 * A slate as a thumbnail: the cells, and the grid they sit on.
 *
 * Shared by the settings panel and the website generator so the two cannot
 * drift into drawing the same slate differently. Geometry only - each surface
 * styles it, and neither has to agree about colour to agree about shape.
 */
export function slateThumbnail(payload: SlatePayload): {
  columns: number
  rows: number
  cells: SlateCell[]
} {
  return {
    columns: payload.columns || 6,
    rows: Math.max(...payload.widgets.map((widget) => widget.y + widget.h), 1),
    cells: payload.widgets.map((widget) => ({
      type: widget.type,
      column: widget.x + 1,
      row: widget.y + 1,
      spanX: widget.w,
      spanY: widget.h,
    })),
  }
}
