/**
 * Produces every marketing image from the built extension.
 *
 * Two outputs, from one set of scenes:
 *   marketing/screenshots/  1280x800 Chrome Web Store screenshots
 *   marketing/site/img/     the same scenes at 2x, for the website
 *
 * Captured inside a real extension context rather than the dev server, so
 * favicons come from Chrome's own cache and the new tab override is exactly
 * what a reviewer sees. Requires `npm run build` first.
 *
 * Content is curated rather than taken from a real profile: the tiles are
 * well-known sites, and every widget that reads browser data is either seeded
 * or left to its own empty state. Nothing personal ends up on a store listing.
 *
 * The scene list is deliberately wider than the store needs. The store takes
 * five (`store: true`), and the website takes all of them — a page that shows
 * three variations of the same dark tile grid undersells an extension whose
 * whole pitch is how far it bends.
 *
 *   node scripts/marketing-shots.mjs
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:http'
import { chromium } from 'playwright'

const dist = resolve('dist')
if (!existsSync(join(dist, 'manifest.json'))) {
  console.error('dist/ is missing. Run `npm run build` first.')
  process.exit(1)
}

const storeDir = resolve('marketing/screenshots')
const siteDir = resolve('marketing/site/img')
mkdirSync(storeDir, { recursive: true })
mkdirSync(siteDir, { recursive: true })

/** The store's required screenshot size. */
const SIZE = { width: 1280, height: 800 }

/** Only scenes captured for both outputs are limited to `--only`. */
const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))

const widget = (id, type, x, y, w, h, config = {}) => ({
  instance: { id, type, config, surface: null },
  layout: { i: id, x, y, w, h },
})

/** Splits `[{instance, layout}]` into the two lists the settings blob wants. */
const canvas = (widgets, extra = {}) => ({
  enabled: true,
  locked: true,
  columns: 6,
  margin: 14,
  instances: widgets.map((w) => w.instance),
  // One flat arrangement, as of settings version 4. A narrow window is given a
  // derived vertical stack instead, so there is no per-breakpoint variant.
  layout: widgets.map((w) => w.layout),
  ...extra,
})

/* --------------------------------------------------------------- content */

/**
 * The generated wallpaper, inlined as a data URL.
 *
 * `useBackgroundSource` prefers `image.url` over `image.blobId`, and
 * `isReadable` in `core/theme/color.ts` counts `data:` as sampleable — so this
 * one string drives both the wallpaper and the accent colour drawn out of it,
 * with no IndexedDB write and no file the page has to be able to reach.
 */
const wallpaperFile = resolve('marketing/assets/wallpaper.png')
if (!existsSync(wallpaperFile)) {
  console.error('marketing/assets/wallpaper.png is missing. Run `node scripts/gen-wallpaper.mjs`.')
  process.exit(1)
}
const WALLPAPER = `data:image/png;base64,${readFileSync(wallpaperFile).toString('base64')}`

/** Sites with a bundled Simple Icons brand logo, so tiles show real marks. */
const TILE_SITES = [
  ['https://github.com', 'GitHub'],
  ['https://figma.com', 'Figma'],
  ['https://linear.app', 'Linear'],
  ['https://notion.so', 'Notion'],
  ['https://youtube.com', 'YouTube'],
  ['https://spotify.com', 'Spotify'],
  ['https://reddit.com', 'Reddit'],
  ['https://news.ycombinator.com', 'Hacker News'],
  ['https://wikipedia.org', 'Wikipedia'],
  ['https://stackoverflow.com', 'Stack Overflow'],
]

const tile = (url, title, extra = {}) => ({
  id: `tile-${title.toLowerCase().replace(/\W+/g, '-')}`,
  kind: 'link',
  url,
  title,
  image: { kind: 'auto', url: '', blobId: '', brandSlug: '' },
  background: null,
  labelPlacement: null,
  pinned: false,
  parentId: '',
  pageId: '',
  ...extra,
})

const TILES = TILE_SITES.map(([url, title]) => tile(url, title))

/**
 * The same sites, filed into folders and split across two named pages.
 *
 * A folder carries no URL of its own; membership is the child's `parentId`.
 * Nothing here is nested deeper than one level, which is all the grid allows.
 *
 * Worth knowing before wondering why the folder previews look plain: a folder
 * draws a grid of its children's *favicons*, read from Chrome's own cache
 * (`useTileVisual`), with no brand-logo path of the kind an ordinary tile has.
 * A throwaway profile has never visited those sites, so the cache is empty and
 * the preview falls back to placeholder marks. Only a real profile fills them,
 * which is why the folders sit beside full-colour tiles here rather than
 * carrying the shot alone.
 */
const FOLDER_TILES = [
  { ...tile('', 'Design'), kind: 'folder', id: 'f-design' },
  tile('https://figma.com', 'Figma', { parentId: 'f-design' }),
  tile('https://dribbble.com', 'Dribbble', { parentId: 'f-design' }),
  tile('https://behance.net', 'Behance', { parentId: 'f-design' }),

  { ...tile('', 'Reading'), kind: 'folder', id: 'f-read' },
  tile('https://news.ycombinator.com', 'Hacker News', { parentId: 'f-read' }),
  tile('https://reddit.com', 'Reddit', { parentId: 'f-read' }),
  tile('https://wikipedia.org', 'Wikipedia', { parentId: 'f-read' }),

  tile('https://github.com', 'GitHub'),
  tile('https://linear.app', 'Linear'),
  tile('https://notion.so', 'Notion'),
  tile('https://stackoverflow.com', 'Stack Overflow'),

  // The second page, reached by the switcher rather than by scrolling.
  tile('https://youtube.com', 'YouTube', { pageId: 'p-play' }),
  tile('https://spotify.com', 'Spotify', { pageId: 'p-play' }),
  tile('https://twitch.tv', 'Twitch', { pageId: 'p-play' }),
]

/**
 * A small calendar the shot can subscribe to.
 *
 * The day view is gated on `sources.length > 0`, so the widget is only ever a
 * month grid without one. Served over HTTP rather than as a `data:` URL: the
 * widget's permission check reads the feed's origin, and a `data:` URL has
 * none — so the check always fails on one.
 */
function demoCalendarIcs() {
  const d = new Date()
  const stamp = (day, h, m) => {
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + day, h, m)
    const p = (n) => String(n).padStart(2, '0')
    return `${t.getFullYear()}${p(t.getMonth() + 1)}${p(t.getDate())}T${p(t.getHours())}${p(t.getMinutes())}00`
  }
  const event = (uid, title, from, to) =>
    ['BEGIN:VEVENT', `UID:${uid}`, `SUMMARY:${title}`, `DTSTART:${from}`, `DTEND:${to}`, 'END:VEVENT']

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Open Slate//Marketing//EN',
    ...event('1', 'Design review', stamp(0, 18, 0), stamp(0, 19, 0)),
    ...event('2', 'Store listing walkthrough', stamp(0, 20, 0), stamp(0, 21, 0)),
    ...event('3', 'Ship it', stamp(0, 22, 0), stamp(0, 22, 30)),
    // A few days either side, so the month grid carries dots rather than one.
    ...event('4', 'Retro', stamp(1, 16, 0), stamp(1, 17, 0)),
    ...event('5', 'Release notes', stamp(2, 11, 0), stamp(2, 12, 0)),
    ...event('6', 'Onboarding call', stamp(-1, 15, 0), stamp(-1, 16, 0)),
    'END:VCALENDAR',
  ].join('\r\n')
}

/** A small RSS feed, so the feeds widget shows headlines rather than a prompt. */
function demoFeedXml() {
  const item = (title, mins) =>
    [
      '<item>',
      `<title>${title}</title>`,
      '<link>https://example.com/</link>',
      `<pubDate>${new Date(Date.now() - mins * 60000).toUTCString()}</pubDate>`,
      '</item>',
    ].join('')

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0"><channel>',
    '<title>The Changelog</title>',
    '<link>https://example.com/</link>',
    item('A new tab page you actually chose', 34),
    item('Why extensions ask for so many permissions', 96),
    item('The quiet death of the RSS reader, again', 180),
    item('Designing for the page you open most', 420),
    '</channel></rss>',
  ].join('')
}

/** Serves the demo calendar and feed so both have a real origin to be granted. */
function serveDemoContent() {
  const ics = demoCalendarIcs()
  const rss = demoFeedXml()
  const server = createServer((req, res) => {
    const type = req.url.endsWith('.xml') ? 'application/rss+xml' : 'text/calendar'
    res.writeHead(200, { 'content-type': type }).end(req.url.endsWith('.xml') ? rss : ics)
  })
  return new Promise((ok) => {
    server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port }))
  })
}

const { server: demoServer, port: demoPort } = await serveDemoContent()
const CALENDAR_URL = `http://127.0.0.1:${demoPort}/work.ics`
const FEED_URL = `http://127.0.0.1:${demoPort}/feed.xml`
const DEMO_ORIGIN = `http://127.0.0.1:${demoPort}/*`

const WEATHER_ORIGIN = 'https://*.open-meteo.com/*'
const CRYPTO_ORIGIN = 'https://api.coingecko.com/*'

const PLACE = {
  name: 'Hyderabad',
  country: 'IN',
  admin: 'Telangana',
  latitude: 17.385,
  longitude: 78.4867,
}

const TASKS = [
  { id: 't1', text: 'Ship the store listing', done: false },
  { id: 't2', text: 'Reply to the design thread', done: false },
  { id: 't3', text: 'Export the screenshots', done: true },
]

/**
 * How many tab rows a widget may show.
 *
 * Five, because the widget's own schema floors `limit` at 5 — ask for four and
 * zod rejects it and restores the default of fourteen, which is how the
 * capture page ends up listing itself.
 */
const TAB_LIMIT = 5

/**
 * Titles seeded into throwaway tabs, for the Open tabs widget and palette.
 *
 * One more is seeded than the widget is allowed to show. `chrome.tabs.query`
 * answers in window order and the capture's own new tab page is opened last,
 * so a list capped at `TAB_LIMIT` can never reach it — which is what keeps
 * `newtab.html` out of a screenshot of itself, under a raw extension id.
 */
const TAB_TITLES = [
  'Open Slate — documentation',
  'Pull requests · GitHub',
  'Figma — Marketing site',
  'Open Meteo — API docs',
  'Chrome Web Store — Developer Dashboard',
  'Instrument Serif — Google Fonts',
]

/* ---------------------------------------------------------------- layouts */

/**
 * The layout this project's author actually runs, reproduced with curated
 * content, on a 6-cell grid.
 *
 * Six is deliberate: the canvas keeps cells ~158px square, so the band needs
 * 6 x 158 = 948px. Ask for more columns than the band can hold and the cell
 * falls under `MIN_CELL` and the whole canvas collapses to one column.
 *
 *   calendar   clock       tasks
 *   calendar   open tabs   tasks
 *   timer      open tabs   weather
 */
const DASHBOARD = [
  widget('w-cal', 'calendar', 0, 0, 2, 2, {
    showAgenda: true,
    sources: [{ url: CALENDAR_URL, name: 'Work', color: 0 }],
  }),
  widget('w-clock', 'clock', 2, 0, 2, 1, { style: 'digital', showSeconds: false, showDate: true }),
  widget('w-todo', 'todo', 4, 0, 2, 2, { items: TASKS }),
  // Limited to the seeded tabs. `chrome.tabs.query` returns window order and
  // the capture's own new tab page is opened last, so capping the list at the
  // number seeded is what keeps `newtab.html` from listing itself.
  widget('w-tabs', 'tabs', 2, 1, 2, 2, { limit: TAB_LIMIT }),
  widget('w-timer', 'timer', 0, 2, 2, 1, { mode: 'pomodoro', showRounds: true }),
  widget('w-weather', 'weather', 4, 2, 2, 1, { detail: 'compact', place: PLACE }),
]

/**
 * Every widget that can be shown with real content, at once — the shot that
 * answers "what do I actually get".
 *
 * Eight columns and four rows: eight is the widest the 1240px band holds
 * before a cell drops under `MIN_CELL` and the canvas collapses to a stack,
 * and four rows is the most that fits an 800px frame without clipping.
 *
 * Three of the fifteen are deliberately absent, because a throwaway profile
 * cannot fill them and an empty card on a marketing page sells nothing:
 * Downloads needs files actually downloaded, Recently closed needs
 * `chrome.sessions` to hold something, and Most visited reads `chrome.topSites`
 * — real browsing history, which a fresh profile answers with the Web Store
 * and nothing else. All three appear in the copy instead.
 *
 *   greeting(4x1)      clock       weather
 *   notes    tasks     feed        crypto
 *   notes    tasks     feed        open tabs
 *   calendar history   bookmarks   open tabs
 *   calendar history   bookmarks   timer
 */
const GALLERY = [
  widget('g-greet', 'greeting', 0, 0, 4, 1, { name: 'Venu', tone: 'greeting', size: 'm' }),
  widget('g-clock', 'clock', 4, 0, 2, 1, { style: 'flip', showDate: true }),
  widget('g-weather', 'weather', 6, 0, 2, 1, { detail: 'compact', place: PLACE }),

  widget('g-notes', 'notes', 0, 1, 2, 2, {
    text: 'Ship v1\n— store listing\n— press kit\n— a page that sells it',
  }),
  widget('g-todo', 'todo', 2, 1, 2, 2, { items: TASKS }),
  widget('g-feed', 'feed', 4, 1, 2, 2, { urls: [FEED_URL], limit: 4, showSource: true }),
  widget('g-crypto', 'crypto', 6, 1, 2, 1, {
    coins: ['bitcoin', 'ethereum', 'solana'],
    currency: 'usd',
  }),
  widget('g-tabs', 'tabs', 6, 2, 2, 2, { limit: TAB_LIMIT }),

  widget('g-cal', 'calendar', 0, 3, 2, 2, {
    showAgenda: false,
    sources: [{ url: CALENDAR_URL, name: 'Work', color: 0 }],
  }),
  widget('g-hist', 'history', 2, 3, 2, 2, { limit: 4, showTime: false }),
  widget('g-book', 'bookmarks', 4, 3, 2, 2, { limit: 4, showHost: false }),
  widget('g-timer', 'timer', 6, 4, 2, 1, { mode: 'pomodoro', showRounds: true }),
]

/**
 * Ten clock faces at once, as a specimen sheet.
 *
 * Five columns, not ten: a cell under `MIN_CELL` (120px) collapses the whole
 * canvas into a single stacked column, and ten columns inside a 1240px band
 * lands at ~113. Five columns of 2x2 cells gives each face a square worth
 * looking at and still fits the pair of rows inside an 800px frame.
 */
const CLOCK_FACES = [
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
].map((style, i) =>
  widget(`c-${style}`, 'clock', (i % 5) * 1, Math.floor(i / 5) * 1, 1, 1, {
    style,
    showSeconds: style === 'analog-classic' || style === 'rings',
    showDate: false,
    label: '',
  }),
)

/* ---------------------------------------------------------------- scenes */

/** Optional hosts the live-data scenes need granted before they render. */
const LIVE = {
  origins: [WEATHER_ORIGIN, CRYPTO_ORIGIN, DEMO_ORIGIN],
  permissions: ['tabs', 'bookmarks', 'history', 'downloads', 'sessions'],
}

/**
 * Opens throwaway tabs so the Open tabs widget and palette have real rows.
 *
 * Every tab the context holds is seeded, including the blank one a persistent
 * context opens with — an unseeded tab would otherwise list itself as
 * `about:blank`. The capture's own new tab page is opened afterwards, and the
 * scenes cap the widget's `limit` at the number seeded so it never lists itself.
 */
const seedTabs = (titles) => async (context) => {
  const existing = context.pages()
  for (const [i, title] of titles.entries()) {
    const page = existing[i] ?? (await context.newPage())
    // The charset matters: without it the title arrives as mojibake.
    await page.goto(`data:text/html;charset=utf-8,${encodeURIComponent(`<title>${title}</title>`)}`)
  }
}

/** The id the wallpaper is stored under, when a scene wants it in the library. */
const WALLPAPER_BLOB_ID = 'img_marketing_wallpaper'

/**
 * Writes the wallpaper into the media library, as an upload would.
 *
 * `mediaStore` is a module inside the bundle and not reachable from a page
 * evaluate, so the record is written straight to IndexedDB in the shape
 * `blobStore.ts` defines: database `newtab-media` version 1, store `media`,
 * keyed on `id`, with an `addedAt` index. `addedAt` is stamped by `put()` in
 * the app, so writing raw means supplying it here.
 */
const seedMedia = async (page) => {
  await page.evaluate(async ({ dataUrl, id }) => {
    const blob = await (await fetch(dataUrl)).blob()
    await new Promise((ok, fail) => {
      const request = indexedDB.open('newtab-media', 1)
      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'id' }).createIndex('addedAt', 'addedAt')
        }
      }
      request.onsuccess = () => {
        const tx = request.result.transaction('media', 'readwrite')
        tx.objectStore('media').put({
          id,
          name: 'dusk.png',
          type: 'image/png',
          size: blob.size,
          width: 2560,
          height: 1600,
          addedAt: Date.now(),
          blob,
        })
        tx.oncomplete = ok
        tx.onerror = () => fail(tx.error)
      }
      request.onerror = () => fail(request.error)
    })
  }, { dataUrl: WALLPAPER, id: WALLPAPER_BLOB_ID })
  await page.waitForTimeout(400)
}

/** Seeds the open tabs and, for scenes that need it, the history behind them. */
const seedTabsAndHistory = (titles) => async (context) => {
  await seedTabs(titles)(context)
  await seedHistory(context)
}

/** Invented bookmarks, written onto the bar so the widget has rows to list. */
const BOOKMARKS = [
  ['Figma — Design system', 'https://figma.com/file/design-system'],
  ['Open Meteo docs', 'https://open-meteo.com/en/docs'],
  ['Simple Icons', 'https://simpleicons.org/'],
  ['Chrome extension docs', 'https://developer.chrome.com/docs/extensions'],
]

/**
 * Invented history.
 *
 * Titles rather than bare URLs, which is why these are visited rather than
 * pushed through `history.addUrl`: that API takes a URL and nothing else, so
 * a page added with it lists under its address. Visiting a local page whose
 * `<title>` is set records both.
 */
const HISTORY = [
  'Figma — Marketing site handoff',
  'Extension quality guidelines',
  'CSS backdrop-filter — MDN',
  'RSS 2.0 specification',
]

/**
 * Writes bookmarks and history into the throwaway profile.
 *
 * Both widgets read Chrome's own stores rather than anything in settings, so
 * they cannot be seeded through a settings patch the way notes and tasks are.
 * `history.addUrl` backdates nothing — the rows all read "just now" — so the
 * scenes that use it turn `showTime` off rather than printing one timestamp
 * four times.
 */
/**
 * Visits a few pages so the History widget and the palette have rows.
 *
 * Visited rather than pushed through `history.addUrl`, which takes a URL and
 * nothing else — a page added that way lists under its address instead of a
 * title. The scratch tab is closed again before the capture page is opened, so
 * it never reaches the Open tabs widget.
 *
 * Runs in the `before` hook, alongside the tab seeding, for the same reason:
 * everything that opens a tab must happen before the capture page does, so the
 * capture page stays last in window order and a `limit` set to the number of
 * seeded tabs is enough to keep `newtab.html` from listing itself.
 */
const seedHistory = async (context) => {
  const scratch = await context.newPage()
  for (const title of HISTORY) {
    await scratch.goto(`data:text/html;charset=utf-8,${encodeURIComponent(`<title>${title}</title>`)}`)
  }
  await scratch.close()
}

/**
 * Writes bookmarks onto the bar, and clears the capture's own tracks.
 *
 * The run has to open `newtab.html` to reach the extension's APIs at all, and
 * that visit lands in the profile's history — where the History widget and the
 * palette would then list "Open Slate" above the seeded rows, under a raw
 * extension id. Deleting the extension's own origin from history afterwards is
 * what keeps the capture out of its own screenshots.
 */
const seedBookmarks = async (page) => {
  await page.evaluate(async (bookmarks) => {
    // The bookmarks bar is node '1'. Existing children are left alone; a
    // fresh profile has none.
    for (const [title, url] of bookmarks) {
      await chrome.bookmarks.create({ parentId: '1', title, url })
    }
    await chrome.history.deleteUrl({ url: location.href })
    await chrome.history.deleteUrl({ url: `${location.origin}/newtab.html` })
  }, BOOKMARKS)
  await page.waitForTimeout(400)
}

/** Wallpaper settings shared by the scenes that sit on the photograph. */
const onWallpaper = (extra = {}) => ({
  type: 'image',
  followTheme: false,
  image: { url: WALLPAPER, blobId: '' },
  fit: 'cover',
  dim: 0.34,
  vignette: 0.28,
  ...extra,
})

const scenes = [
  /* ------------------------------------------------------------ the page */
  {
    // The one that sells hardest: a real photograph, glass panels over it, and
    // an accent pulled out of the sky. Leads the site and the store listing.
    name: 'wallpaper',
    site: 'wallpaper',
    store: true,
    scheme: 'dark',
    ...LIVE,
    before: seedTabs(TAB_TITLES),
    settings: {
      appearance: {
        mode: 'dark',
        accentSource: 'wallpaper',
        surface: 'glass',
        surfaceOpacity: 0.32,
        surfaceBlur: 26,
        radius: 20,
        shadow: 'soft',
      },
      background: onWallpaper(),
      widgets: canvas(DASHBOARD),
      layout: { order: ['search', 'widgets'], viewMode: 'tabs', maxWidth: 1180, paddingY: 22, gap: 18 },
    },
  },
  {
    // The maintainer's own layout on the default gradient: calendar day view
    // and tasks flanking the clock and open tabs, timer and weather below.
    name: 'dashboard',
    site: 'dashboard',
    store: true,
    scheme: 'dark',
    ...LIVE,
    before: seedTabs(TAB_TITLES),
    settings: {
      widgets: canvas(DASHBOARD),
      layout: { order: ['search', 'widgets'], viewMode: 'tabs', maxWidth: 1180, paddingY: 22, gap: 18 },
    },
  },
  {
    // Every seedable widget in one frame. Eight columns and a taller band,
    // because fifteen widgets do not fit in six without falling off the edge.
    name: 'widget-gallery',
    site: 'widget-gallery',
    scheme: 'dark',
    ...LIVE,
    before: seedTabsAndHistory(TAB_TITLES),
    seedBrowserData: true,
    settings: {
      appearance: { mode: 'dark', density: 'compact', radius: 14, fontScale: 0.92 },
      widgets: canvas(GALLERY, { columns: 8, margin: 10 }),
      // `align: 'top'` and almost no padding: five rows of cells is taller than
      // an 800px frame, and centring would clip the top and bottom equally
      // rather than letting the last row sit against the edge.
      layout: { order: ['widgets'], viewMode: 'tabs', maxWidth: 1240, paddingY: 8, gap: 8, align: 'top' },
    },
  },
  {
    // Ten faces, one grid. The clock is the widget everyone recognises, so the
    // range of it is the quickest way to show how far the rest bends.
    name: 'clock-faces',
    site: 'clock-faces',
    scheme: 'dark',
    settings: {
      appearance: { mode: 'dark', surface: 'glass', radius: 18 },
      background: onWallpaper({ dim: 0.5, blur: 8 }),
      widgets: canvas(CLOCK_FACES, { columns: 5, margin: 14 }),
      layout: { order: ['widgets'], viewMode: 'tabs', maxWidth: 900, paddingY: 40, gap: 12, align: 'center' },
    },
  },

  /* ---------------------------------------------------------------- tiles */
  {
    name: 'speed-dial',
    site: 'speed-dial',
    store: true,
    scheme: 'dark',
    settings: {
      tiles: { items: TILES, width: 168, aspect: 1.6, gap: 16, labelVisibility: 'always', plateStyle: 'tinted' },
      layout: { order: ['search', 'tiles'], align: 'center' },
      widgets: { enabled: false },
    },
  },
  {
    // Folders and a second page: the two things that make a grid of ten scale
    // to a grid of fifty without becoming a wall.
    name: 'folders',
    site: 'folders',
    scheme: 'dark',
    settings: {
      background: onWallpaper({ dim: 0.45, blur: 3 }),
      tiles: {
        items: FOLDER_TILES,
        pages: [{ id: 'p-play', name: 'Watch' }],
        pageSwitcher: 'tabs',
        width: 156,
        aspect: 1.5,
        gap: 16,
        labelVisibility: 'always',
        plateStyle: 'tinted',
      },
      layout: { order: ['search', 'tiles'], align: 'center' },
      widgets: { enabled: false },
    },
  },
  {
    // The four plate styles are the single most visible tile setting, and the
    // hardest to describe in words. One page, one style, shot four times.
    name: 'tile-plates',
    site: 'tile-plates',
    scheme: 'dark',
    settings: {
      // Eight tiles at four across: a clean 4x2 block with no ragged last row.
      // The add button is off because the four shots are read side by side as
      // one comparison, and a dashed "+" in the corner of each is noise.
      tiles: {
        items: TILES.slice(0, 8),
        width: 168,
        aspect: 1.6,
        gap: 16,
        labelVisibility: 'always',
        plateStyle: 'brand',
        columns: 4,
        showAddButton: false,
      },
      layout: { order: ['tiles'], align: 'center' },
      widgets: { enabled: false },
    },
  },

  /* ----------------------------------------------------------- the range */
  {
    // The appearance settings taken somewhere completely different, to show
    // the range: light, boxy, solid plates, no glass.
    name: 'make-it-yours',
    site: 'make-it-yours',
    store: true,
    scheme: 'light',
    settings: {
      appearance: { mode: 'light', preset: 'paper', radius: 2, surface: 'solid', shadow: 'soft', density: 'comfortable' },
      tiles: { items: TILES, labelVisibility: 'always', labelPlacement: 'below', plateStyle: 'neutral', aspect: 1.3, width: 152, gap: 18 },
      layout: { order: ['search', 'tiles'], align: 'center' },
      widgets: { enabled: false },
    },
  },
  {
    // The same dashboard in the light Paper palette, outlined rather than
    // glass. Proof that the dark shots are a choice and not the only mode.
    name: 'light-dashboard',
    site: 'light-dashboard',
    scheme: 'light',
    ...LIVE,
    before: seedTabs(TAB_TITLES),
    settings: {
      appearance: { mode: 'light', preset: 'paper', surface: 'outline', radius: 10, shadow: 'soft', density: 'comfortable' },
      background: { type: 'solid', followTheme: true },
      widgets: canvas(DASHBOARD),
      layout: { order: ['search', 'widgets'], viewMode: 'tabs', maxWidth: 1180, paddingY: 22, gap: 18 },
    },
  },

  /* -------------------------------------------------------------- search */
  {
    name: 'command-palette',
    site: 'command-palette',
    store: true,
    scheme: 'dark',
    // Without these the palette can only ever show Tile, Command and Search
    // rows — the badges that prove it reaches your browser would be missing.
    ...LIVE,
    before: seedTabsAndHistory(TAB_TITLES),
    seedBrowserData: true,
    settings: {
      tiles: { items: TILES, width: 168, aspect: 1.6, gap: 16, labelVisibility: 'always' },
      layout: { order: ['search', 'tiles'] },
      widgets: { enabled: false },
    },
    async act(page) {
      await page.keyboard.press('ControlOrMeta+k')
      await page.waitForTimeout(450)
      // A query that lands in every category the palette can answer from: the
      // Figma tile, the open Figma tab, the bookmarked file, the page in
      // history, and the web-search fallback that always comes last. Five
      // badges in one frame is the whole claim the palette makes.
      await page.keyboard.type('figma', { delay: 70 })
      await page.waitForTimeout(900)
    },
  },

  /* ------------------------------------------------------------ settings */
  {
    name: 'settings',
    site: 'settings',
    store: true,
    scheme: 'dark',
    settings: {},
    async act(page, id) {
      await page.goto(`chrome-extension://${id}/options.html`)
      await page.waitForTimeout(1000)
    },
  },
  {
    // The wallpaper section, with a photograph in the media library so the
    // library and the adjustment sliders are sitting over something rather
    // than over a gradient and an empty shelf.
    name: 'settings-wallpaper',
    site: 'settings-wallpaper',
    scheme: 'dark',
    // Deliberately the blobId route rather than the data URL every other
    // wallpaper scene uses: `image.url` is rendered verbatim into the "Image
    // address" field, and a 4MB base64 string across that box is not what the
    // section looks like in use.
    settings: { background: { ...onWallpaper(), image: { url: '', blobId: WALLPAPER_BLOB_ID } } },
    seedMedia: true,
    async act(page, id) {
      await page.goto(`chrome-extension://${id}/options.html`)
      await page.waitForTimeout(700)
      await openSection(page, 'Wallpaper')
    },
  },
  {
    // Settings search: one query, results drawn from several sections at once.
    // This is the mode that shows the settings screen cannot fall behind the
    // extension, because both are generated from one declaration.
    name: 'settings-search',
    site: 'settings-search',
    scheme: 'dark',
    settings: {},
    async act(page, id) {
      await page.goto(`chrome-extension://${id}/options.html`)
      await page.waitForTimeout(700)
      // Two characters is the threshold. `colour` is the query that best shows
      // what the mode is for: it matches the palette picker and the accent in
      // Appearance, and the plate and label colours over in Tiles, so results
      // arrive under more than one section heading at once.
      await page.getByPlaceholder('Search settings').fill('colour')
      await page.waitForTimeout(600)
    },
  },
]

/** Clicks a settings section by its visible label and waits for it to land. */
async function openSection(page, label) {
  const item = page.locator('.settings__navitem', { hasText: label })
  await item.click()
  await page
    .locator(`.settings__navitem[aria-current="true"]`)
    .filter({ hasText: label })
    .waitFor({ timeout: 5000 })
  await page.waitForTimeout(500)
}

/* --------------------------------------------------------------- capture */

/** Copies the build, moving `origins` and `perms` from optional to required. */
function patchedExtension(origins, perms) {
  const dir = mkdtempSync(join(tmpdir(), 'os-ext-'))
  cpSync(dist, dir, { recursive: true })
  const file = join(dir, 'manifest.json')
  const manifest = JSON.parse(readFileSync(file, 'utf8'))

  manifest.host_permissions = [...(manifest.host_permissions ?? []), ...origins]
  manifest.optional_host_permissions = (manifest.optional_host_permissions ?? [])
    .filter((o) => !origins.includes(o))

  manifest.permissions = [...(manifest.permissions ?? []), ...perms]
  manifest.optional_permissions = (manifest.optional_permissions ?? [])
    .filter((o) => !perms.includes(o))

  writeFileSync(file, JSON.stringify(manifest, null, 2))
  return dir
}

/**
 * The tile-plates scene is one settings change shot four times, so it is
 * captured as a strip rather than as four separate scenes.
 */
const PLATE_STYLES = ['brand', 'neutral', 'tinted', 'transparent']

for (const scene of scenes) {
  if (only.length && !only.includes(scene.name)) continue

  // A scene that needs an optional host gets its own copy of the build with
  // that host promoted to a required permission. `permissions.request` needs a
  // user gesture that a capture run cannot produce, and the shipped build must
  // keep the host optional — so the patch lives in a throwaway directory.
  const ext =
    scene.origins || scene.permissions
      ? patchedExtension(scene.origins ?? [], scene.permissions ?? [])
      : dist

  // The store wants exactly 1280x800; the site wants the same framing at 2x.
  // A scene not marked `store` is only ever captured for the site.
  for (const scale of scene.store ? [1, 2] : [2]) {
    const isStore = scale === 1
    const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'os-mkt-')), {
      channel: 'chromium',
      headless: true,
      viewport: SIZE,
      deviceScaleFactor: scale,
      colorScheme: scene.scheme,
      args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
    })

    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'))
    const id = new URL(worker.url()).host

    if (scene.before) await scene.before(context)

    const page = await context.newPage()
    await page.setViewportSize(SIZE)
    await page.goto(`chrome-extension://${id}/newtab.html`)
    // Let the first run seed its tiles before overlaying the scene's settings.
    await page.waitForTimeout(1700)

    // Bookmarks and history live in Chrome's stores, not in settings, so they
    // are written from the page once the permissions are in place.
    if (scene.seedBrowserData) await seedBookmarks(page)
    if (scene.seedMedia) await seedMedia(page)

    const apply = async (patch) => {
      await page.evaluate(async (values) => {
        const { settings } = await chrome.storage.local.get('settings')
        const merged = { ...settings }
        for (const [section, section_values] of Object.entries(values)) {
          merged[section] = { ...merged[section], ...section_values }
        }
        await chrome.storage.local.set({ settings: merged })
      }, patch)
      await page.waitForTimeout(1000)
    }

    if (Object.keys(scene.settings).length) await apply(scene.settings)

    // Widgets that fetch render a spinner first; a shot taken then is useless.
    await page
      .waitForFunction(
        () => !/Fetching|Loading/i.test(document.body.innerText),
        undefined,
        { timeout: 15000 },
      )
      .catch(() => console.warn('   (a widget was still loading)'))

    if (scene.act) await scene.act(page, id)

    if (scene.name === 'tile-plates') {
      // Four plate styles, one file each, so the site can show them together.
      // Clipped to the grid itself rather than shot full-frame: the four are
      // only ever read side by side, and four full pages of empty background
      // would leave the comparison a quarter the size on the page.
      for (const plateStyle of PLATE_STYLES) {
        await apply({ tiles: { plateStyle } })
        const grid = page.locator('.tiles').first()
        const out = join(siteDir, `plate-${plateStyle}@2x.png`)
        await grid.screenshot({ path: out })
        console.log(out.replace(process.cwd() + '/', ''))
      }
    } else {
      const out = isStore
        ? join(storeDir, `${scene.name}.png`)
        : join(siteDir, `${scene.site}@2x.png`)
      await page.screenshot({ path: out })
      console.log(out.replace(process.cwd() + '/', ''))
    }

    await context.close()
  }
}

demoServer.close()
