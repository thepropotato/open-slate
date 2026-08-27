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
export const SETTINGS_VERSION = 3

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
  preset: z.string().default('graphite'),
  /** Where the accent colour comes from. `wallpaper` samples the background. */
  accentSource: z.enum(['preset', 'wallpaper', 'custom']).default('wallpaper'),
  accent: hex.default('#6ea8fe'),
  /** Master corner radius, in px. 0 == fully boxy. Drives every surface. */
  radius: z.number().min(0).max(40).default(16),
  density: z.enum(['compact', 'comfortable', 'spacious']).default('spacious'),
  fontFamily: z.string().default('system'),
  fontScale: z.number().min(0.75).max(1.5).default(1),
  /** How widget and panel surfaces are painted. */
  surface: z.enum(['glass', 'solid', 'outline', 'none']).default('glass'),
  surfaceOpacity: unit.default(0.4),
  surfaceBlur: z.number().min(0).max(40).default(18),
  shadow: z.enum(['none', 'soft', 'strong']).default('none'),
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
  /** A folder has no URL of its own; it groups the tiles whose parent it is. */
  kind: z.enum(['link', 'folder']).default('link'),
  url: z.string(),
  title: z.string().default(''),
  image: TileImage.prefault({}),
  /** Overrides the derived brand colour when set. */
  background: hex.nullable().default(null),
  /** Per-tile override of the global label rules. */
  labelPlacement: z.enum(['below', 'inside-bottom', 'inside-top', 'none']).nullable().default(null),
  pinned: z.boolean().default(false),
  /**
   * Membership is stored flat, as a parent id rather than nested children.
   * Reordering, moving between folders and validation all stay trivial that way,
   * and zod does not have to describe a recursive shape.
   */
  parentId: z.string().default(''),
  /** Empty means the first page. */
  pageId: z.string().default(''),
})
export type Tile = z.infer<typeof Tile>

export const TilePage = z.object({
  id: z.string(),
  name: z.string().default(''),
})
export type TilePage = z.infer<typeof TilePage>

export const Tiles = z.object({
  enabled: z.boolean().default(true),
  items: z.array(Tile).default([]),
  /** Extra pages beyond the first. An empty list means a single page. */
  pages: z.array(TilePage).default([]),
  /** How to move between pages when there is more than one. */
  pageSwitcher: z.enum(['dots', 'tabs', 'hidden']).default('dots'),
  /** `0` means fit as many as the viewport allows. */
  columns: z.number().min(0).max(16).default(5),
  width: z.number().min(60).max(400).default(190),
  /** width / height */
  aspect: z.number().min(0.5).max(3).default(1.75),
  gap: z.number().min(0).max(64).default(18),
  /** Null follows `appearance.radius`. */
  radius: z.number().min(0).max(60).nullable().default(null),
  labelPlacement: z.enum(['below', 'inside-bottom', 'inside-top', 'none']).default('inside-bottom'),
  labelVisibility: Visibility.default('hover'),
  labelAlign: z.enum(['start', 'center', 'end']).default('center'),
  /**
   * How the tile's plate is coloured relative to the logo:
   *  brand       plate takes the brand colour, mark goes black or white
   *  neutral     plate matches the theme surface, mark takes the brand colour
   *  tinted      plate is a wash of the brand colour, mark takes it too
   *  transparent no plate at all
   */
  plateStyle: z.enum(['brand', 'neutral', 'tinted', 'transparent']).default('tinted'),
  imageFit: z.enum(['cover', 'contain']).default('contain'),
  imagePadding: z.number().min(0).max(40).default(32),
  hoverEffect: z.enum(['none', 'lift', 'zoom', 'glow', 'tilt']).default('lift'),
  openIn: z.enum(['current', 'newTab']).default('current'),
  showAddButton: z.boolean().default(true),
}).prefault({})

/* ------------------------------------------------------------- background */

export const Background = z.object({
  type: z.enum(['solid', 'gradient', 'image', 'video', 'slideshow']).default('gradient'),
  /**
   * When true, the solid colour and the gradient are derived from the active
   * theme palette instead of the stored hexes. On by default so that switching
   * palette or light/dark actually changes the whole page, rather than leaving a
   * fixed dark wallpaper behind light panels.
   */
  followTheme: z.boolean().default(true),
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
  vignette: unit.default(0.12),
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

/**
 * A blank dashboard is a bad first impression, so a new profile starts with one
 * clock. It is an ordinary instance: it can be moved, reconfigured or deleted.
 */
const DEFAULT_CLOCK_ID = 'clock-default'

export const Widgets = z.object({
  enabled: z.boolean().default(true),
  instances: z.array(WidgetInstance).prefault([{ id: DEFAULT_CLOCK_ID, type: 'clock' }]),
  /** Layouts keyed by breakpoint name (`lg`, `md`, `sm`). */
  layouts: z.record(z.string(), z.array(GridItem)).prefault({
    lg: [{ i: DEFAULT_CLOCK_ID, x: 2, y: 0, w: 2, h: 1 }],
    md: [{ i: DEFAULT_CLOCK_ID, x: 1, y: 0, w: 2, h: 1 }],
    sm: [{ i: DEFAULT_CLOCK_ID, x: 0, y: 0, w: 2, h: 1 }],
  }),
  /**
   * Cells across at the widest breakpoint. One cell is a small widget, and
   * cells are square, so this is really "how big is a widget" — fewer columns
   * means larger widgets. Narrower breakpoints scale down from here.
   */
  columns: z.number().min(4).max(10).default(6),
  margin: z.number().min(0).max(48).default(14),
  /** When locked, widgets cannot be dragged or resized. */
  locked: z.boolean().default(true),
  compact: z.enum(['vertical', 'horizontal', 'none']).default('vertical'),
}).prefault({})

/* ------------------------------------------------------------------ layout */

/** Which of the two content bands a tab shows. Search belongs to neither. */
export const Pane = z.enum(['widgets', 'tiles'])
export type Pane = z.infer<typeof Pane>

export const Layout = z.object({
  /** Vertical stacking order of the page's three main bands. */
  /**
   * Which bands appear, and in what order. Search is always hoisted to the top
   * by the shell, so its position here only decides whether it appears at all.
   */
  order: z.array(z.enum(['widgets', 'search', 'tiles'])).default(['search', 'widgets', 'tiles']),
  align: z.enum(['top', 'center', 'bottom']).default('center'),
  maxWidth: z.number().min(600).max(2400).default(1180),
  paddingY: z.number().min(0).max(200).default(48),
  gap: z.number().min(0).max(120).default(36),
  /**
   * `scroll` stacks every band on one scrolling page. `tabs` shows one content
   * band at a time behind a switch, so a tall dashboard never buries the tiles.
   */
  viewMode: z.enum(['scroll', 'tabs']).default('tabs'),
  /** Which pane a new tab opens on. `last` reopens whatever was left showing. */
  defaultPane: z.enum(['last', 'widgets', 'tiles']).default('last'),
  /** Written on every switch so `defaultPane: 'last'` has something to read. */
  lastPane: Pane.default('widgets'),
}).prefault({})

/* ------------------------------------------------------------------ search */

export const Search = z.object({
  enabled: z.boolean().default(true),
  engineId: z.string().default('google'),
  showEnginePicker: z.boolean().default(false),
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

/* -------------------------------------------------------------------- sync */

/**
 * Deliberately not one of the synced sections: each device opts in for itself,
 * so enabling sync on a laptop does not silently enable it everywhere.
 */
export const Sync = z.object({
  enabled: z.boolean().default(false),
  /** Push after a change, and pull on load. Off means the buttons only. */
  auto: z.boolean().default(true),
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
  sync: Sync,
})

export type Settings = z.infer<typeof Settings>
export type Appearance = z.infer<typeof Appearance>
export type Tiles = z.infer<typeof Tiles>
export type Background = z.infer<typeof Background>
export type Widgets = z.infer<typeof Widgets>
export type SearchSettings = z.infer<typeof Search>
export type Layout = z.infer<typeof Layout>
export type Behavior = z.infer<typeof Behavior>
export type Sync = z.infer<typeof Sync>

export const defaultSettings = (): Settings => Settings.parse({})
