# Chrome Web Store listing copy

Paste-ready fields for the listing. The permission justifications and the
single-purpose statement live in [`../STORE.md`](../STORE.md), which is the file
a reviewer's questions map to.

## Name

```
Open Slate — New Tab Dashboard
```

## Short description (132 characters max)

```
Your most-opened page, finally yours. A speed dial and dashboard for the new tab. No analytics, no content scripts.
```

*114 characters.*

## Detailed description

```
Your most-opened page, finally yours.

You open a new tab dozens of times a day and never chose what's on it. Open
Slate replaces it with a speed dial and dashboard — tiles, widgets and a
wallpaper engine, with close to everything about the look under your control.

TILES THAT LOOK LIKE THE SITES THEY OPEN
Logos for 233 sites come bundled, drawn in the brand's own colour. Every other
site gets its favicon rendered large on a plate tinted by sampling that favicon,
so the grid stays coherent even for sites nobody has a logo for. Drag to
reorder, drop onto a folder to file it away, split tiles across named pages, or
open by position with Alt+1 to Alt+9.

FIFTEEN WIDGETS, AND NONE OF THEM OVERLAP
A grid of square cells with five standard sizes that widgets snap to, the way
phone widgets do. Growing or dropping one moves whatever was in the way — at
every window size, not just the one you are looking at.

Clock (ten faces), weather, calendar, notes, greeting, tasks (priorities, due
dates and filters, all typed rather than clicked), timer (pomodoro, countdown,
stopwatch), RSS feeds, crypto prices, recently closed tabs, most visited, open
tabs with a duplicate finder, bookmarks, history and downloads.

SEARCH AND A COMMAND PALETTE
23 search engines with bang shortcuts (!yt cats), address detection so typing a
host navigates, and an inline calculator. Cmd/Ctrl+K searches your tabs, tiles,
bookmarks, history and every settings command at once. Suggestions come from
your own data — nothing is sent anywhere as you type.

MAKE IT YOURS
Eight palettes, automatic light and dark, a corner radius from fully round to
fully square, four surface styles, three densities, and an accent that can be
sampled from your wallpaper. Wallpaper can be a solid colour, a gradient, an
image, a video or a slideshow, with dim, blur, brightness, saturation, zoom,
vignette and a slow-drift option.

Every preference is searchable and applies live across every open tab. Export
your whole configuration to a file, or share a theme code that carries the look
without carrying your tiles, notes or tasks.

IT ASKS FOR NOTHING
No analytics, no telemetry, no crash reporting, no identifiers. No content
scripts — the extension runs on its own page and nowhere else, so it cannot read
the sites you visit. It installs with four permissions; tabs, history,
bookmarks, downloads and sessions are requested the moment you add the widget
that needs one, and declining leaves the rest working.

Settings and tiles are stored locally. Wallpapers live in IndexedDB and are
never uploaded. Sync is off unless you turn it on, per device.

TWO THINGS WORTH KNOWING
Chrome does not expose an installed theme's colours to extensions, only whether
you are in light or dark mode — so "match Chrome" here means automatic
light/dark, eight palettes and a wallpaper-sampled accent.

Geolocation is never declared and never called. The weather widget places itself
from an approximate, city-level lookup, which you can correct by typing a town.

Free and open source.
```

## Category

`Workflow & Planning`

## Screenshots

The store allows five. In order, from `screenshots/`:

| # | File | Caption |
| --- | --- | --- |
| 1 | `wallpaper.png` | Your wallpaper, with the accent drawn out of it |
| 2 | `dashboard.png` | Fifteen widgets on a grid that never overlaps |
| 3 | `speed-dial.png` | Your sites, drawn in their own brand colours |
| 4 | `command-palette.png` | Tabs, tiles, bookmarks and history, one keystroke away |
| 5 | `make-it-yours.png` | The same grid, four settings apart |

`npm run marketing:shots` writes several more scenes to `marketing/site/img/`
than the store takes — the settings page, the widget gallery, the ten clock
faces, folders and pages, the four tile plate styles, the light dashboard, and
two more settings sections. Those carry the website; the five above are the
store's.

The dashboard and wallpaper shots reproduce the layout this project's author
actually runs, with curated content: the calendar and feed are subscribed to
small demos served locally for the capture, the tabs, bookmarks and history are
invented and seeded into a throwaway profile, and nothing personal appears.

## Promo tiles

- Small tile, 440x280 — `promo/small-tile-440x280.png`
- Marquee, 1400x560 — `promo/marquee-1400x560.png`

## Privacy practices

Single purpose and per-permission justifications: [`../STORE.md`](../STORE.md).

Data usage certification: **no** data is collected for every category. The
extension has no analytics, no remote code and no server.
