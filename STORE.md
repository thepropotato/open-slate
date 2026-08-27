# Chrome Web Store submission notes

New tab overrides are reviewed manually and rejected for vague permission
justifications, so this is the material that has to be ready before uploading.

## Single purpose

Replace the browser's new tab page with a customisable speed dial and dashboard:
a grid of user-chosen site tiles, a search box, and widgets showing the user's own
browser data (recently closed tabs, open tabs, bookmarks, history, downloads,
most-visited sites) alongside a clock, calendar, weather, notes and tasks.

Everything the extension does serves that one page. It has no content scripts, no
remote code, and no analytics.

## Permissions, and why each is needed

| Permission | Why |
| --- | --- |
| `storage` | Stores the user's settings, tiles and widget layout. |
| `unlimitedStorage` | Wallpaper images and videos the user chooses are held in IndexedDB and can exceed the default quota. |
| `favicon` | Draws each tile and list row with the site's own icon, read from Chrome's local favicon cache rather than fetched from a third party. |
| `alarms` | Advances the wallpaper slideshow on a schedule while no tab is open. |
| `topSites` | Seeds the tile grid on first run, and powers the "Most visited" widget. |

## Optional permissions, requested only on use

These are declared as `optional_permissions` and requested at the moment the user
adds the widget that needs them. Declining leaves the rest of the page working.

| Permission | Requested by |
| --- | --- |
| `sessions` | The "Recently closed" widget, to reopen a closed tab with its history intact. |
| `tabs` | The "Open tabs" widget and the command palette, to list and switch to open tabs. |
| `bookmarks` | The bookmarks widget and palette results. |
| `history` | The history widget and palette results. |
| `downloads` | The downloads widget. |
| `geolocation` | Optional, only if the user asks the weather widget to use their location instead of typing a city. |
| `https://*.open-meteo.com/*` | The weather widget's only network request. Open-Meteo needs no account or API key. |

## Data handling disclosures

- **No data is collected, transmitted or sold.** There is no analytics, telemetry
  or crash reporting of any kind.
- Settings, tiles, notes and tasks are stored locally in `chrome.storage.local`.
- Wallpapers and custom tile images are stored locally in IndexedDB and are never
  uploaded.
- Browser data read through the optional permissions above is used only to render
  the page and never leaves the device.
- The single outbound request in the whole extension is to `api.open-meteo.com`,
  made only when the weather widget is added, carrying only the coordinates of the
  place the user selected.
- The search box sends nothing anywhere as you type: suggestions come from local
  tabs, bookmarks, history and tiles. Submitting a search navigates to the chosen
  engine, exactly as the address bar would.

## Assets

`npm run store:shots` writes the five required 1280x800 screenshots to `store/`,
captured from the built extension in a real extension context — so the favicons
and the new tab override are exactly what a reviewer will see.

- [x] `1-speed-dial.png` — the default page
- [x] `2-dashboard.png` — widgets, search and tiles together
- [x] `3-light-and-boxy.png` — light palette, square corners, neutral plates,
      showing how far the appearance settings go
- [x] `4-palette.png` — the command palette
- [x] `5-settings.png` — the settings page
- [ ] 440x280 small promo tile (needs a designer; the extension icon generator in
      `scripts/gen-icons.mjs` is the starting point for the mark)
- [ ] Store description, drawn from `README.md`
