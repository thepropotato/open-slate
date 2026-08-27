# New Tab

A Chrome extension that replaces the new tab page with a speed dial and dashboard:
image tiles, widgets, and a wallpaper engine, with close to everything about the
look under your control.

## Running it

```sh
npm install
npm run build      # writes dist/
```

Then in Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked** →
choose `dist/`.

For UI work, `npm run dev` serves the page at `http://localhost:5173/newtab.html`.
The `chrome.*` APIs are behind [`src/core/platform/browser.ts`](src/core/platform/browser.ts),
which falls back to `localStorage` and a public favicon service outside the
extension — so the whole interface is workable in an ordinary tab. Anything that
genuinely needs the browser (tabs, history, sessions, downloads) shows its empty
state there.

```sh
npm run check       # typecheck, lint, unused-icon check, self-test
npm run test:dom    # feed parser, in a real page (needs the dev server)
npm run shots       # screenshots every screen in both colour schemes, into ./shots
npm run store:shots # 1280x800 store screenshots, from the built extension
```

## What it does

**Tiles.** Image tiles with the site's logo, its title under or inside the tile,
and a favicon badge in a corner — each of those independently set to always, on
hover, or never. Logos come from a bundled [Simple Icons](https://simpleicons.org)
dataset (233 sites) with the brand colour; every other site gets its favicon
rendered large on a plate tinted by sampling that favicon. You can also paste an
image URL or upload your own. Drag to reorder in Arrange mode, `Alt+1`–`9` to open
by position, arrow keys to move between tiles.

**Wallpaper.** Solid, gradient, image, video or slideshow, with dim, blur,
brightness, saturation, zoom, vignette and a slow-drift option. Video pauses when
the tab is hidden. Slideshow position lives in storage and advances on a
background alarm, so every open tab agrees and rotation continues with no tab
open. The accent colour can be sampled from whatever is on screen.

**Widgets.** A resizable grid, locked by default. Fifteen widgets: clock (ten
faces — digital, minimal, mono, flip, words, binary, three analog variants,
rings), weather, calendar, notes, tasks, greeting, timer (pomodoro, countdown,
stopwatch), feeds, crypto prices, recently closed, most visited, open tabs (with
a duplicate finder), bookmarks, history and downloads.

**Tiles in folders and across pages.** Drag a tile onto a folder in Arrange mode
to file it away; split tiles across named pages with a dot or tab switcher.

**Search.** 23 engines with bang shortcuts (`!yt cats`, or `cats !yt`), address
detection so typing a host navigates, an inline calculator, and suggestions drawn
from your own tabs, tiles, bookmarks and history.

**Command palette.** `Cmd`/`Ctrl`+`K` over tabs, tiles, bookmarks, history and
settings commands, with a web search as the fallback.

**Settings.** Every preference is declared once, as a schema field plus a spec
entry, and the UI renders itself from that. Searchable, with live updates across
every open tab. Full config export and import, theme codes that carry the look
without carrying your content, and opt-in sync across devices.

## Two things worth knowing

**Chrome does not expose the installed browser theme's colours to extensions.**
Only light versus dark is detectable, via `prefers-color-scheme`. So "match
Chrome" is implemented as automatic light/dark, eight palettes, and an accent that
can be sampled from your wallpaper.

**Permissions are asked for when you use a feature, not at install.** The
extension installs with `storage`, `favicon`, `alarms` and `topSites`. Tabs,
history, bookmarks, downloads, sessions, geolocation and the weather host are all
optional, requested the moment you add the widget that needs them.

## Layout

```
src/
  core/          settings schema and store, theme, platform shim, storage, UI primitives
  features/      tiles, background, widgets, search, palette, settings UI
  generated/     brands.json, built from simple-icons
scripts/         icon generation, brand data, screenshots, self-test
```

Adding a widget means one directory under `src/features/widgets/` and one import
in its `index.ts`. The definition carries its own config schema, footprint,
settings fields and permissions; the canvas, picker and settings UI all read it
from there.

Adding a setting means a field in [`src/core/settings/schema.ts`](src/core/settings/schema.ts)
and an entry in the matching file under `src/features/settings-ui/sections/`.
Nothing else. A development-time check fails loudly if a spec path does not exist
in the schema.

## Store submission

New tab overrides get a manual review, so `STORE.md` holds the single-purpose
description and the per-permission justifications.
