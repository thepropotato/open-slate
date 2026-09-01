# Open Slate — Build Plan

A Chrome MV3 extension replacing the new tab with a customizable speed dial / dashboard.

**Known constraint:** Chrome exposes no API for reading the user's installed browser theme colors
(only light/dark via `prefers-color-scheme`). "Match Chrome's theme" is therefore implemented as
auto light/dark + presets + accent auto-extracted from the wallpaper, with manual override.

**Stack:** Vite + React + TS · Font Awesome (only icon source) · Simple Icons (offline brand logos)
· `chrome.storage.sync` for settings · IndexedDB for wallpaper/video blobs · optional permissions
requested per widget.

---

## Phase 0 — Foundation
- [x] Scaffold Vite + React + TS, MV3 manifest, newtab override, dev HMR
- [x] Design tokens as CSS vars; `radius` token drives rounded↔boxy everywhere
- [x] Settings core: zod schema + defaults + version migrations
- [x] `useSettings()` with live `storage.onChanged` sync across open tabs
- [x] Schema-driven settings UI: declare a setting once, control auto-renders
- [x] Font Awesome subset + icon-only rule enforced by lint

## Phase 1 — Tiles (the speed dial)
- [x] Tile data model: url, title, hero image, favicon, brand color, custom overrides
- [x] Tile grid: responsive, drag-reorder, add/edit/delete
- [x] Auto-fill on add: Simple Icons logo + brand bg, fallback to `_favicon` API
- [x] Custom image upload / paste URL per tile
- [x] Hover reveal: title + corner favicon, configurable (always/hover/never, position)
- [x] Tile style settings: radius, size, columns, gap, aspect, shadow, label placement
- [x] Seed from `chrome.topSites` on first run

## Phase 2 — Background engine
- [x] Layer system: solid / gradient / image / video / slideshow
- [x] IndexedDB blob store + upload UI + size guardrails
- [x] Video wallpaper: loop, mute, pause on tab blur, respect `prefers-reduced-motion`
- [x] Overlay controls: dim, blur, saturation, scale, vignette
- [x] Accent extraction from wallpaper → feeds theme tokens
- [x] Slideshow rotation via `chrome.alarms`

## Phase 3 — Widget framework
- [x] Widget registry: manifest (id, icon, sizes, component, settings panel, defaults)
- [x] Grid canvas: drag, resize, snap, per-breakpoint layouts, lock mode
- [x] Per-widget config panel + global widget chrome (glass/solid/none, radius, opacity)
- [x] Optional-permission gate on widget enable

## Phase 4 — Core widgets
- [x] Clock: 6+ styles (digital, flip, minimal, binary, text, analog variants), 12/24h, seconds, timezone
- [x] Search bar: engine switcher, bang shortcuts (`!yt`, `!gh`), inline calculator
- [x] Continue: recently closed tabs + last session (`chrome.sessions`)
- [x] Weather: Open-Meteo, no API key, manual or geolocated city
- [x] Notes scratchpad (autosave)
- [x] Todo list
- [x] Date/calendar month view
- [x] Greeting line (name, time-aware)

## Phase 5 — Browser-native widgets
<!-- Tab groups were dropped from the tabs widget: the duplicate finder and
     cross-window jump carry it, and grouping added a permission for little gain. -->
- [x] Top sites
- [x] Bookmarks folder viewer
- [x] Recent downloads
- [x] Open tabs overview: count, tab groups, duplicate finder
- [x] History quick search

## Phase 6 — Command palette
- [x] `Cmd+K` unified search: tabs, bookmarks, history, tiles, settings, actions
- [x] Keyboard nav across tiles (arrows + digits 1–9 to open)

## Phase 7 — Polish & ship
- [x] Full settings page: tabbed, search, live preview
- [x] Export/import config JSON; reset to defaults
- [x] Theme presets + shareable theme strings
- [x] Perf pass: fast paint, lazy widgets, preload wallpaper
- [x] A11y: focus rings, reduced motion, contrast check
- [x] Store assets + single-purpose justification (new tab overrides get manual review)

## Phase 8 — Optional / later
- [ ] Google Calendar + Gmail unread (OAuth) — **blocked, see below**
- [x] RSS reader, crypto ticker (stocks left out — see below)
- [x] Pomodoro / timer / stopwatch
- [x] Tile folders and multiple pages
- [x] Sync layout across devices

---

## Not built, and why

**Google Calendar and Gmail widgets (OAuth).** These need an OAuth 2.0 client ID
registered in a Google Cloud project, with the extension's ID on the allow-list.
The extension ID is derived from the signing key, which only exists once the item
is published (or a `key` is pinned in the manifest). Shipping the code without a
client ID would mean a widget that cannot work, and hard-coding someone else's
would leak their quota. To add it:

1. Create a Google Cloud project, enable the Calendar and Gmail APIs, and consent
   to the OAuth screen.
2. Publish the extension once (or add its `key` to the manifest) to fix its ID.
3. Create a Chrome-extension OAuth client for that ID.
4. Add `"oauth2": { "client_id": "…", "scopes": [...] }` and the `identity`
   permission to the manifest, then read tokens via `chrome.identity.getAuthToken`.

The widget framework needs no changes for this — a widget declaring
`permissions: ['identity']` would be gated the same way the weather widget is.

**Stock quotes.** Every free equities API requires an API key, and a key inside a
published extension is public: it gets scraped, rate-limited and revoked. The
crypto widget uses CoinGecko's keyless public endpoint instead, and the widget is
named for what it actually does rather than implying stocks.

## Notes recorded during the build
- Settings persist to `chrome.storage.local`, not `sync`: `sync` caps items at 8KB,
  which a tile list plus grid layouts blows past. Cross-device sync is Phase 8 and
  will push a trimmed subset. The store abstraction takes the area as a parameter,
  so switching is a one-line change.
- TypeScript is pinned to 5.9 — `typescript-eslint` does not yet support TS 7.
- Simple Icons has dropped brands whose logo licence is not permissive (Amazon,
  LinkedIn, OpenAI, Prime Video, Hotstar among them). Those tiles — and every
  site outside the curated 233 — use the site's own favicon rendered large on a
  plate tinted by sampling that favicon. Visually near-identical, and legally clean.
- Tiles reorder in an explicit "Arrange" mode rather than on always-on drag, so a
  plain click always navigates.
- Wallpaper dim/blur/vignette apply only to images and video. Applied to a solid or
  gradient they just muted a colour the palette had already chosen.
- Solid and gradient wallpapers follow the theme palette by default, so light/dark
  and palette switches change the whole page rather than leaving a fixed wallpaper.
- `--surface-tint` (subtle fills drawn over content) inverts between light and dark;
  a fixed white tint made every slider track and hover wash invisible in light mode.
- Cross-origin pixel reads need CORS headers, so accent sampling is attempted only
  for the wallpaper the user explicitly chose, never for the many favicon URLs.
- `npm run shots` captures every screen with Playwright, in both colour schemes.
  Most of this UI only exists on hover or behind a settings tab.
- react-grid-layout 2.x dropped `WidthProvider` and moved drag/resize into config
  objects; `@types/react-grid-layout` is v1-only and was removed, since v2 ships
  its own types. The canvas measures width with the library's `useContainerWidth`.
- Search suggestions lead with the user's own tabs, tiles, bookmarks and history,
  which is more useful on a browser dashboard than raw engine completions. The
  engine's completions rank below them and are skipped for arithmetic and
  addresses, so what leaves the device is only what would have been searched.
- The calculator is a hand-written recursive-descent parser. MV3 forbids `eval`
  and `new Function` outright, and the grammar is then exactly what is documented.
- Font Awesome icon *definitions* are plain path data, so `Icon` renders them with
  one `<svg>` instead of shipping `fontawesome-svg-core` and `react-fontawesome`.
  That took the icon bundle from 128KB to 34KB. Font Awesome is still the only
  icon source, and `npm run icons:check` fails on any unreferenced entry.
- The eager bundle for a new tab is ~459KB raw / ~140KB gzip, down from ~610KB:
  the drag library, the palette and every dialog load on demand. zod stays eager
  because settings are parsed before first paint.
- Light-mode token defaults live in `tokens.css` under `prefers-color-scheme`, so
  a light-mode user never sees a dark flash in the moment before JS runs.
- Tile columns use `auto-fit`, not a fixed track count: fixed tracks stay reserved
  when empty, which left a short grid visibly off-centre.
- `npm test` covers the pure logic screenshots cannot — calculator, bangs, address
  detection, migrations, theme codes, timezone maths, contrast. 83 checks.
- `npm run store:shots` captures the store screenshots from the built extension in
  a real extension context, which also serves as the end-to-end check that the
  manifest, service worker and favicon API all work.
- Folder and page membership is stored flat, as `parentId` and `pageId` on each
  tile, rather than as nested children. Reordering, moving and validation all stay
  trivial, zod never has to describe a recursive shape, and a dangling reference
  is unrepresentable — a tile whose folder was deleted just reads as a root tile.
- Deleting a folder or a page moves its contents out rather than deleting them.
- The timer stores absolute timestamps, not a decremented countdown, so it
  survives the page being torn down on navigation and every open tab agrees.
- Cross-device sync is not a mirror of the settings blob: `chrome.storage.sync`
  caps items at 8KB and the area at 100KB, so each section is chunked across keys,
  device-local media references are stripped, and sync bookkeeping is kept in
  `local` so it can never cause a write loop. The `sync` section itself is not
  synced, so each device opts in for itself.
- The feeds widget needs `https://*/*` in `optional_host_permissions`, because
  Chrome only grants a runtime origin request that matches a declared pattern.
  Nothing is granted at install — verified — and each feed asks for its own origin
  alone. `STORE.md` carries the justification for review.
- Custom settings controls receive the field scope, which is how a widget ships a
  bespoke control over its own config (the feed list, the coin picker) without the
  settings layer knowing anything about feeds or coins.
- `npm run test:dom` covers the feed parser in a real page, since Node has no
  DOMParser and shipping a DOM shim to test one module is a bad trade.
- Clock faces are hand-built. The maintained analog-clock packages each give one
  fixed look, and the requirement was a range of faces all reading from the theme
  tokens. Faces size themselves in container query units, so resizing scales them.
