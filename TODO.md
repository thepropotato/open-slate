# New Tab — Build Plan

A Chrome MV3 extension replacing the new tab with a customizable speed dial / dashboard.

**Known constraint:** Chrome exposes no API for reading the user's installed browser theme colors
(only light/dark via `prefers-color-scheme`). "Match Chrome's theme" is therefore implemented as
auto light/dark + presets + accent auto-extracted from the wallpaper, with manual override.

**Stack:** Vite + React + TS · Font Awesome (only icon source) · Simple Icons (offline brand logos)
· `chrome.storage.sync` for settings · IndexedDB for wallpaper/video blobs · optional permissions
requested per widget.

---

## Phase 0 — Foundation
- [ ] Scaffold Vite + React + TS, MV3 manifest, newtab override, dev HMR
- [ ] Design tokens as CSS vars; `radius` token drives rounded↔boxy everywhere
- [ ] Settings core: zod schema + defaults + version migrations
- [ ] `useSettings()` with live `storage.onChanged` sync across open tabs
- [ ] Schema-driven settings UI: declare a setting once, control auto-renders
- [ ] Font Awesome subset + icon-only rule enforced by lint

## Phase 1 — Tiles (the speed dial)
- [ ] Tile data model: url, title, hero image, favicon, brand color, custom overrides
- [ ] Tile grid: responsive, drag-reorder, add/edit/delete
- [ ] Auto-fill on add: Simple Icons logo + brand bg, fallback to `_favicon` API
- [ ] Custom image upload / paste URL per tile
- [ ] Hover reveal: title + corner favicon, configurable (always/hover/never, position)
- [ ] Tile style settings: radius, size, columns, gap, aspect, shadow, label placement
- [ ] Seed from `chrome.topSites` on first run

## Phase 2 — Background engine
- [ ] Layer system: solid / gradient / image / video / slideshow
- [ ] IndexedDB blob store + upload UI + size guardrails
- [ ] Video wallpaper: loop, mute, pause on tab blur, respect `prefers-reduced-motion`
- [ ] Overlay controls: dim, blur, saturation, scale, vignette
- [ ] Accent extraction from wallpaper → feeds theme tokens
- [ ] Slideshow rotation via `chrome.alarms`

## Phase 3 — Widget framework
- [ ] Widget registry: manifest (id, icon, sizes, component, settings panel, defaults)
- [ ] Grid canvas: drag, resize, snap, per-breakpoint layouts, lock mode
- [ ] Per-widget config panel + global widget chrome (glass/solid/none, radius, opacity)
- [ ] Optional-permission gate on widget enable

## Phase 4 — Core widgets
- [ ] Clock: 6+ styles (digital, flip, minimal, binary, text, analog variants), 12/24h, seconds, timezone
- [ ] Search bar: engine switcher, bang shortcuts (`!yt`, `!gh`), inline calculator
- [ ] Continue: recently closed tabs + last session (`chrome.sessions`)
- [ ] Weather: Open-Meteo, no API key, manual or geolocated city
- [ ] Notes scratchpad (autosave)
- [ ] Todo list
- [ ] Date/calendar month view
- [ ] Greeting line (name, time-aware)

## Phase 5 — Browser-native widgets
- [ ] Top sites
- [ ] Bookmarks folder viewer
- [ ] Recent downloads
- [ ] Open tabs overview: count, tab groups, duplicate finder
- [ ] History quick search

## Phase 6 — Command palette
- [ ] `Cmd+K` unified search: tabs, bookmarks, history, tiles, settings, actions
- [ ] Keyboard nav across tiles (arrows + digits 1–9 to open)

## Phase 7 — Polish & ship
- [ ] Full settings page: tabbed, search, live preview
- [ ] Export/import config JSON; reset to defaults
- [ ] Theme presets + shareable theme strings
- [ ] Perf pass: fast paint, lazy widgets, preload wallpaper
- [ ] A11y: focus rings, reduced motion, contrast check
- [ ] Store assets + single-purpose justification (new tab overrides get manual review)

## Phase 8 — Optional / later
- [ ] Google Calendar + Gmail unread (OAuth)
- [ ] RSS reader, stocks/crypto ticker
- [ ] Pomodoro / timer / stopwatch
- [ ] Tile folders and multiple pages
- [ ] Sync layout across devices
