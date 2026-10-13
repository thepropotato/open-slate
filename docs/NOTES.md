# Design notes

Why the extension is built the way it is. Decisions that are not obvious from the
code, and things deliberately left out. Keep this to reasons; what the product does
is in the README.

## Not built, and why

**Gmail unread (OAuth).** It needs an OAuth 2.0 client ID registered in a Google Cloud
project with the extension's ID on the allow-list, a consent screen, and Google's
review for sensitive scopes. A client ID inside a published extension is public, so
it would be shared quota. Calendar does not need any of this: the calendar widget
subscribes to iCalendar feed URLs, which is read-only by construction and works with
Google, Apple and Outlook calendars alike.

**Stock quotes.** Every free equities API requires an API key, and a key inside a
published extension is public: it gets scraped, rate-limited and revoked. The crypto
widget uses CoinGecko's keyless public endpoint instead, and the widget is named for
what it actually does rather than implying stocks.

**Tab groups.** Dropped from the open tabs widget: the duplicate finder and
cross-window jump carry it, and grouping added a permission for little gain.

## Notes recorded during the build
- Settings persist to `chrome.storage.local`, not `sync`: `sync` caps items at 8KB,
  which a tile list plus grid layouts blows past. Cross-device sync is Phase 8 and
  will push a trimmed subset. The store abstraction takes the area as a parameter,
  so switching is a one-line change.
- TypeScript is pinned to 5.9 - `typescript-eslint` does not yet support TS 7.
- Simple Icons has dropped brands whose logo licence is not permissive (Amazon,
  LinkedIn, OpenAI, Prime Video, Hotstar among them). Those tiles - and every
  site outside the curated 233 - use the site's own favicon rendered large on a
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
- `npm test` covers the pure logic screenshots cannot: calculator, address detection,
  migrations, theme codes, timezone maths, contrast.
- `npm run store:shots` captures the store screenshots from the built extension in
  a real extension context, which also serves as the end-to-end check that the
  manifest, service worker and favicon API all work.
- Folder and page membership is stored flat, as `parentId` and `pageId` on each
  tile, rather than as nested children. Reordering, moving and validation all stay
  trivial, zod never has to describe a recursive shape, and a dangling reference
  is unrepresentable - a tile whose folder was deleted just reads as a root tile.
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
  Nothing is granted at install - verified - and each feed asks for its own origin
  alone. `STORE.md` carries the justification for review.
- Custom settings controls receive the field scope, which is how a widget ships a
  bespoke control over its own config (the feed list, the coin picker) without the
  settings layer knowing anything about feeds or coins.
- `npm run test:dom` covers the feed parser in a real page, since Node has no
  DOMParser and shipping a DOM shim to test one module is a bad trade.
- Clock faces are hand-built. The maintained analog-clock packages each give one
  fixed look, and the requirement was a range of faces all reading from the theme
  tokens. Faces size themselves in container query units, so resizing scales them.

## Added with the interface rework

- Built-in wallpapers are saved as `preset:<id>`, not as an extension URL, so a setting
  survives a changed extension ID (store build, sideload and dev all differ) and syncs
  across devices. `preset:auto`, the default, is Dawn in dark and Mist in light.
  `npm run marketing:shots` and `scripts/gen-wallpaper.mjs` draw them; each scene is an
  SVG rendered to JPEG, so there is no image dependency and nothing is downloaded.
- Settings edits are staged in a draft. While the settings panel is open the page is
  wrapped in `DraftPreview`, which swaps the saved values for the draft, so the real page
  is the preview. Only values are swapped: effects such as first-run seeding still need
  to write, and the modal panel already keeps the page inert.
- The toolbar popup uses `activeTab`, granted by the click, so it sees the current tab's
  address and title and nothing else. It links to the new tab with a hash
  (`newtab.html#settings`, `#arrange`, `#palette`) for the actions that need the page.
- Scenes and settings snapshots live in `chrome.storage.local` beside the settings blob,
  not inside it: they are per browser, and the blob stays what sync and export carry.
  A scheduled scene is applied once when its window starts (a cursor remembers which
  scene was last applied), so a manual change later in the same window is not undone.
- Secondary and tertiary text are raised to readable contrast per palette when the
  presets load (`readable` in `theme/presets.ts`), and `npm test` checks every palette,
  so a new palette cannot ship below the minimum.
- Fonts are bundled woff2 files (`core/theme/fontFaces.css`, licences in `public/fonts/licenses`),
  not a CDN and not only locally installed ones. A face downloads nothing and loads only when
  its family is in use, so a new tab on the system font pays nothing for the others. The settings
  panel and popup always use the brand font; the new tab uses whatever the user chose.
