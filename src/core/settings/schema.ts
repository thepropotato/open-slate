import { z } from 'zod'

/**
 * The single source of truth for every persisted preference.
 *
 * Every field carries a `.default()`, so `Settings.parse({})` yields a complete
 * settings object. That property is what makes migrations cheap: parsing an old
 * blob fills in whatever fields were added since it was written.
 *
 * Widget-specific options deliberately do NOT live here — each widget owns its
 * own config schema (see `core/widgets/registry.ts`) and this file only stores
 * the opaque blob.
 */

export const SETTINGS_KEY = 'settings'
export const SETTINGS_VERSION = 1

const hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
const unit = z.number().min(0).max(1)

/* ------------------------------------------------------------- appearance */

export const Corner = z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
export type Corner = z.infer<typeof Corner>

export const Visibility = z.enum(['always', 'hover', 'never'])
export type Visibility = z.infer<typeof Visibility>

export const Appearance = z.object({
  /** `auto` follows the OS/Chrome light-dark setting via `prefers-color-scheme`. */
  mode: z.enum(['auto', 'light', 'dark']).default('auto'),
  preset: z.string().default('midnight'),
  /** Where the accent colour comes from. `wallpaper` samples the background. */
  accentSource: z.enum(['preset', 'wallpaper', 'custom']).default('preset'),
  accent: hex.default('#6ea8fe'),
  /** Master corner radius, in px. 0 == fully boxy. Drives every surface. */
  radius: z.number().min(0).max(40).default(16),
  density: z.enum(['compact', 'comfortable', 'spacious']).default('comfortable'),
  fontFamily: z.string().default('system'),
  fontScale: z.number().min(0.75).max(1.5).default(1),
  /** How widget and panel surfaces are painted. */
  surface: z.enum(['glass', 'solid', 'outline', 'none']).default('glass'),
  surfaceOpacity: unit.default(0.4),
  surfaceBlur: z.number().min(0).max(40).default(18),
  shadow: z.enum(['none', 'soft', 'strong']).default('soft'),
  animations: z.boolean().default(true),
  /** Hides all chrome until the pointer moves. */
  zenMode: z.boolean().default(false),
}).prefault({})

/* ------------------------------------------------------------------ tiles */

export const TileImage = z.object({
  kind: z.enum(['auto', 'brand', 'favicon', 'url', 'upload', 'monogram']).default('auto'),
  /** Remote image URL when `kind === 'url'`. */
  url: z.string().default(''),
  /** IndexedDB blob id when `kind === 'upload'`. */
  blobId: z.string().default(''),
  /** Simple Icons slug when `kind === 'brand'`; empty means resolve from URL. */
  brandSlug: z.string().default(''),
})
export type TileImage = z.infer<typeof TileImage>

export const Tile = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().default(''),
  image: TileImage.prefault({}),
  /** Overrides the derived brand colour when set. */
  background: hex.nullable().default(null),
  /** Per-tile override of the global label/favicon rules. */
  labelPlacement: z.enum(['below', 'inside-bottom', 'inside-top', 'none']).nullable().default(null),
  pinned: z.boolean().default(false),
})
export type Tile = z.infer<typeof Tile>

export const Tiles = z.object({
  enabled: z.boolean().default(true),
  items: z.array(Tile).default([]),
  /** `0` means fit as many as the viewport allows. */
  columns: z.number().min(0).max(16).default(5),
  width: z.number().min(60).max(400).default(190),
  /** width / height */
  aspect: z.number().min(0.5).max(3).default(1.75),
  gap: z.number().min(0).max(64).default(18),
  /** Null follows `appearance.radius`. */
  radius: z.number().min(0).max(60).nullable().default(null),
  labelPlacement: z.enum(['below', 'inside-bottom', 'inside-top', 'none']).default('below'),
  labelVisibility: Visibility.default('hover'),
  labelAlign: z.enum(['start', 'center', 'end']).default('center'),
  faviconVisibility: Visibility.default('hover'),
  faviconCorner: Corner.default('bottom-left'),
  faviconSize: z.number().min(12).max(48).default(22),
  /**
   * How the tile's plate is coloured relative to the logo:
   *  brand       plate takes the brand colour, mark goes black or white
   *  neutral     plate matches the theme surface, mark takes the brand colour
   *  tinted      plate is a wash of the brand colour, mark takes it too
   *  transparent no plate at all
   */
  plateStyle: z.enum(['brand', 'neutral', 'tinted', 'transparent']).default('brand'),
  imageFit: z.enum(['cover', 'contain']).default('contain'),
  imagePadding: z.number().min(0).max(40).default(14),
  hoverEffect: z.enum(['none', 'lift', 'zoom', 'glow', 'tilt']).default('lift'),
  openIn: z.enum(['current', 'newTab']).default('current'),
  showAddButton: z.boolean().default(true),
}).prefault({})

/* ------------------------------------------------------------- background */

export const Background = z.object({
  type: z.enum(['solid', 'gradient', 'image', 'video', 'slideshow']).default('gradient'),
  color: hex.default('#0b0d12'),
  gradient: z.object({
    from: hex.default('#101318'),
    to: hex.default('#05070a'),
    angle: z.number().min(0).max(360).default(160),
  }).prefault({}),
  /** Either a blob id from the local media library or a remote URL. */
  image: z.object({
    blobId: z.string().default(''),
    url: z.string().default(''),
  }).prefault({}),
  video: z.object({
    blobId: z.string().default(''),
    url: z.string().default(''),
    muted: z.boolean().default(true),
    loop: z.boolean().default(true),
    playbackRate: z.number().min(0.25).max(2).default(1),
    /** Stops decoding while the tab is hidden — matters a lot for battery. */
    pauseWhenHidden: z.boolean().default(true),
  }).prefault({}),
  slideshow: z.object({
    blobIds: z.array(z.string()).default([]),
    urls: z.array(z.string()).default([]),
    intervalMinutes: z.number().min(1).max(1440).default(30),
    shuffle: z.boolean().default(true),
    crossfade: z.boolean().default(true),
  }).prefault({}),
  fit: z.enum(['cover', 'contain', 'fill', 'tile', 'center']).default('cover'),
  position: z.string().default('center'),
  dim: unit.default(0.25),
  blur: z.number().min(0).max(60).default(0),
  saturation: z.number().min(0).max(2).default(1),
  brightness: z.number().min(0.2).max(2).default(1),
  scale: z.number().min(1).max(1.5).default(1),
  vignette: unit.default(0.2),
  /** Slow drift/zoom on the still image. */
  kenBurns: z.boolean().default(false),
}).prefault({})

/* ---------------------------------------------------------------- widgets */

export const GridItem = z.object({
  i: z.string(),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
})
export type GridItem = z.infer<typeof GridItem>

export const WidgetInstance = z.object({
  id: z.string(),
  type: z.string(),
  /** Validated by the owning widget's own schema, not here. */
  config: z.record(z.string(), z.unknown()).prefault({}),
  /** Per-instance surface override; null inherits `appearance.surface`. */
  surface: z.enum(['glass', 'solid', 'outline', 'none']).nullable().default(null),
})
export type WidgetInstance = z.infer<typeof WidgetInstance>

export const Widgets = z.object({
  enabled: z.boolean().default(true),
  instances: z.array(WidgetInstance).default([]),
  /** Layouts keyed by breakpoint name (`lg`, `md`, `sm`). */
  layouts: z.record(z.string(), z.array(GridItem)).prefault({}),
  columns: z.number().min(4).max(48).default(24),
  rowHeight: z.number().min(20).max(160).default(56),
  margin: z.number().min(0).max(48).default(14),
  /** When locked, widgets cannot be dragged or resized. */
  locked: z.boolean().default(true),
  compact: z.enum(['vertical', 'horizontal', 'none']).default('none'),
}).prefault({})

/* ------------------------------------------------------------------ layout */

export const Layout = z.object({
  /** Vertical stacking order of the page's three main bands. */
  order: z.array(z.enum(['widgets', 'search', 'tiles'])).default(['search', 'tiles', 'widgets']),
  align: z.enum(['top', 'center', 'bottom']).default('center'),
  maxWidth: z.number().min(600).max(2400).default(1180),
  paddingY: z.number().min(0).max(200).default(48),
  gap: z.number().min(0).max(120).default(36),
}).prefault({})

/* ------------------------------------------------------------------ search */

export const Search = z.object({
  enabled: z.boolean().default(true),
  engineId: z.string().default('google'),
  showEnginePicker: z.boolean().default(true),
  autofocus: z.boolean().default(false),
  placeholder: z.string().default('Search the web'),
  width: z.number().min(240).max(1200).default(680),
  height: z.number().min(36).max(88).default(56),
  /** `!yt cats` style prefixes that redirect to another engine. */
  bangs: z.boolean().default(true),
  /** Evaluate arithmetic typed into the box before searching. */
  calculator: z.boolean().default(true),
  suggestions: z.boolean().default(true),
}).prefault({})

/* -------------------------------------------------------------- behaviour */

export const Behavior = z.object({
  commandPalette: z.boolean().default(true),
  tileNumberShortcuts: z.boolean().default(true),
  confirmDelete: z.boolean().default(true),
  greetingName: z.string().default(''),
  locale: z.string().default(''),
  /** Overrides the browser timezone for every time-based widget. */
  timezone: z.string().default(''),
}).prefault({})

/* ------------------------------------------------------------------- root */

export const Settings = z.object({
  version: z.number().default(SETTINGS_VERSION),
  appearance: Appearance,
  layout: Layout,
  tiles: Tiles,
  background: Background,
  widgets: Widgets,
  search: Search,
  behavior: Behavior,
})

export type Settings = z.infer<typeof Settings>
export type Appearance = z.infer<typeof Appearance>
export type Tiles = z.infer<typeof Tiles>
export type Background = z.infer<typeof Background>
export type Widgets = z.infer<typeof Widgets>
export type SearchSettings = z.infer<typeof Search>
export type Layout = z.infer<typeof Layout>
export type Behavior = z.infer<typeof Behavior>

export const defaultSettings = (): Settings => Settings.parse({})
