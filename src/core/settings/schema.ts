import { z } from 'zod'

/**
 * Every persisted preference. Every field carries a `.default()`, so parsing an
 * old blob fills in whatever was added since — that is the whole migration story.
 * Widget config lives in each widget's own schema; here it is an opaque blob.
 */

export const SETTINGS_KEY = 'settings'
export const SETTINGS_VERSION = 5

const hex = z.string().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/)
const unit = z.number().min(0).max(1)

export const Corner = z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
export type Corner = z.infer<typeof Corner>

export const Visibility = z.enum(['always', 'hover', 'never'])
export type Visibility = z.infer<typeof Visibility>

export const Appearance = z.object({
  // `auto` follows `prefers-color-scheme`.
  mode: z.enum(['auto', 'light', 'dark']).default('auto'),
  preset: z.string().default('graphite'),
  // `wallpaper` samples the background image.
  accentSource: z.enum(['preset', 'wallpaper', 'custom']).default('wallpaper'),
  accent: hex.default('#6ea8fe'),
  // px; 0 is fully boxy. Drives every surface.
  radius: z.number().min(0).max(40).default(16),
  density: z.enum(['compact', 'comfortable', 'spacious']).default('spacious'),
  fontFamily: z.string().default('system'),
  fontScale: z.number().min(0.75).max(1.5).default(1),
  surface: z.enum(['glass', 'solid', 'outline', 'none']).default('glass'),
  surfaceOpacity: unit.default(0.4),
  surfaceBlur: z.number().min(0).max(40).default(18),
  shadow: z.enum(['none', 'soft', 'strong']).default('none'),
  animations: z.boolean().default(true),
  // Hides all chrome until the pointer moves.
  zenMode: z.boolean().default(false),
}).prefault({})

export const TileImage = z.object({
  kind: z.enum(['auto', 'brand', 'favicon', 'url', 'upload', 'monogram']).default('auto'),
  // Used only when `kind` matches: url / upload (IndexedDB blob id) / brand (Simple Icons slug).
  url: z.string().default(''),
  blobId: z.string().default(''),
  brandSlug: z.string().default(''),
})
export type TileImage = z.infer<typeof TileImage>

export const Tile = z.object({
  id: z.string(),
  // A folder has no URL of its own; it groups the tiles parented to it.
  kind: z.enum(['link', 'folder']).default('link'),
  url: z.string(),
  title: z.string().default(''),
  image: TileImage.prefault({}),
  // Overrides the derived brand colour when set.
  background: hex.nullable().default(null),
  labelPlacement: z.enum(['below', 'inside-bottom', 'inside-top', 'none']).nullable().default(null),
  pinned: z.boolean().default(false),
  // Membership is flat rather than nested, so zod needs no recursive shape.
  parentId: z.string().default(''),
  // Empty means the first page.
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
  // Extra pages beyond the first; empty means a single page.
  pages: z.array(TilePage).default([]),
  pageSwitcher: z.enum(['dots', 'tabs', 'hidden']).default('dots'),
  // 0 fits as many as the viewport allows.
  columns: z.number().min(0).max(16).default(5),
  width: z.number().min(60).max(400).default(190),
  // width / height
  aspect: z.number().min(0.5).max(3).default(1.75),
  gap: z.number().min(0).max(64).default(18),
  // Null follows `appearance.radius`.
  radius: z.number().min(0).max(60).nullable().default(null),
  labelPlacement: z.enum(['below', 'inside-bottom', 'inside-top', 'none']).default('inside-bottom'),
  labelVisibility: Visibility.default('hover'),
  labelAlign: z.enum(['start', 'center', 'end']).default('center'),
  // brand: plate is brand-coloured, mark black/white. neutral: theme surface, brand mark.
  // tinted: wash of brand for both. transparent: no plate.
  plateStyle: z.enum(['brand', 'neutral', 'tinted', 'transparent']).default('tinted'),
  imageFit: z.enum(['cover', 'contain']).default('contain'),
  imagePadding: z.number().min(0).max(40).default(32),
  hoverEffect: z.enum(['none', 'lift', 'zoom', 'glow', 'tilt']).default('lift'),
  openIn: z.enum(['current', 'newTab']).default('current'),
  showAddButton: z.boolean().default(true),
}).prefault({})

export const Background = z.object({
  type: z.enum(['solid', 'gradient', 'image', 'video', 'slideshow']).default('gradient'),
  // Derives colour and gradient from the theme palette instead of the stored hexes,
  // so switching palette or light/dark changes the whole page.
  followTheme: z.boolean().default(true),
  color: hex.default('#0b0d12'),
  gradient: z.object({
    from: hex.default('#101318'),
    to: hex.default('#05070a'),
    angle: z.number().min(0).max(360).default(160),
  }).prefault({}),
  // Either a blob id from the local media library or a remote URL.
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
    // Stops decoding while the tab is hidden; matters a lot for battery.
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
  // Slow drift/zoom on the still image.
  kenBurns: z.boolean().default(false),
}).prefault({})

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
  // Validated by the owning widget's schema, not here.
  config: z.record(z.string(), z.unknown()).prefault({}),
  // Null inherits `appearance.surface`.
  surface: z.enum(['glass', 'solid', 'outline', 'none']).nullable().default(null),
})
export type WidgetInstance = z.infer<typeof WidgetInstance>

// A new profile starts with one clock, as an ordinary movable/deletable instance.
const DEFAULT_CLOCK_ID = 'clock-default'

export const Widgets = z.object({
  enabled: z.boolean().default(true),
  instances: z.array(WidgetInstance).prefault([{ id: DEFAULT_CLOCK_ID, type: 'clock' }]),
  // The single arrangement, at `columns` across. No per-breakpoint variants:
  // a too-narrow window gets a vertical stack derived on the fly and never stored.
  layout: z.array(GridItem).prefault([{ i: DEFAULT_CLOCK_ID, x: 2, y: 0, w: 2, h: 1 }]),
  // Cells across. Cells are square and one cell is a small widget, so fewer columns means bigger widgets.
  columns: z.number().min(4).max(10).default(6),
  margin: z.number().min(0).max(48).default(14),
  locked: z.boolean().default(true),
  compact: z.enum(['vertical', 'horizontal', 'none']).default('vertical'),
}).prefault({})

/** Which of the two content bands a tab shows. Search belongs to neither. */
export const Pane = z.enum(['widgets', 'tiles'])
export type Pane = z.infer<typeof Pane>

export const Layout = z.object({
  // Which bands appear, and in what order. The shell always hoists search to the
  // top, so its position here only decides whether it appears at all.
  order: z.array(z.enum(['widgets', 'search', 'tiles'])).default(['search', 'widgets', 'tiles']),
  align: z.enum(['top', 'center', 'bottom']).default('center'),
  maxWidth: z.number().min(600).max(2400).default(1180),
  paddingY: z.number().min(0).max(200).default(48),
  gap: z.number().min(0).max(120).default(36),
  // `tabs` shows one content band at a time, so a tall dashboard never buries the tiles.
  viewMode: z.enum(['scroll', 'tabs']).default('tabs'),
  defaultPane: z.enum(['last', 'widgets', 'tiles']).default('last'),
  // Written on every switch so `defaultPane: 'last'` has something to read.
  lastPane: Pane.default('widgets'),
}).prefault({})

export const Search = z.object({
  enabled: z.boolean().default(true),
  autofocus: z.boolean().default(false),
  placeholder: z.string().default('Search the web'),
  width: z.number().min(240).max(1200).default(680),
  height: z.number().min(36).max(88).default(56),
  // Evaluate arithmetic typed into the box before searching.
  calculator: z.boolean().default(true),
  suggestions: z.boolean().default(true),
  // Completions as you type. Unlike the above, this sends the query out.
  webSuggestions: z.boolean().default(true),
}).prefault({})

export const Behavior = z.object({
  commandPalette: z.boolean().default(true),
  tileNumberShortcuts: z.boolean().default(true),
  confirmDelete: z.boolean().default(true),
  greetingName: z.string().default(''),
  locale: z.string().default(''),
  // Overrides the browser timezone for every time-based widget.
  timezone: z.string().default(''),
}).prefault({})

// Deliberately not itself synced: each device opts in for itself.
export const Sync = z.object({
  enabled: z.boolean().default(false),
  // Push after a change, pull on load. Off means the buttons only.
  auto: z.boolean().default(true),
}).prefault({})

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
