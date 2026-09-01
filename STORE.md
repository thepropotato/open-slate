# Chrome Web Store submission notes

New tab overrides are reviewed manually and rejected for vague permission
justifications, so this is the material that has to be ready before uploading.

## Single purpose

Replace the browser's new tab page with a customisable speed dial and dashboard:
a grid of user-chosen site tiles (optionally in folders and across pages), a
search box, and widgets showing the user's own browser data (recently closed tabs,
open tabs, bookmarks, history, downloads, most-visited sites) alongside a clock,
calendar, weather, notes, tasks, a timer, feeds, crypto prices, and the user's
own usage figures from AI services they are already signed in to.

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

| Host permission | Why |
| --- | --- |
| `https://suggestqueries.google.com/*` | Google's public autocomplete endpoint, for search-box completions. Required rather than optional because Google is the default engine and completions are on by default, so making it optional would put a permission prompt in front of the first search a user ever types. See below. |

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
| `scripting` | The Claude and ChatGPT usage widgets, to run one read on the provider's own page. See below. |
| `https://*.open-meteo.com/*` | The weather widget's forecast and place search. Open-Meteo needs no account or API key. |
| `https://get.geojs.io/*`, `https://ipwho.is/*` | A one-off, city-level location lookup so the weather widget can place itself without a permission prompt. Two providers because either free service may rate-limit. Requested together with Open-Meteo, and never called again once a place is set. |
| `https://api.coingecko.com/*` | The crypto widget's only network request. CoinGecko's public endpoint needs no account or API key. |
| `https://claude.ai/*` | The Claude usage widget, to read that account's own usage figures. |
| `https://chatgpt.com/*` | The ChatGPT usage widget, to read that account's own usage figures. |
| `https://*/*` | Required so the feeds widget can request access to **one origin at a time**, chosen by the user. See below. |
| `https://duckduckgo.com/*`, `https://www.bing.com/*`, `https://search.brave.com/*`, `https://ac.ecosia.org/*`, `https://www.startpage.com/*`, `https://en.wikipedia.org/*`, `https://completion.amazon.com/*` | Search completions from an engine other than Google, requested the first time the user selects that engine. Declining leaves that engine working with local suggestions alone. See below. |

### On geolocation

The extension does **not** declare `geolocation`. Chrome refuses to make it an
optional permission, and requiring it would put a "know your physical location"
warning in front of every install for one widget.

The widget also never calls `navigator.geolocation`: the object exists on an
extension page, but the call fails without the manifest permission and logs a
console warning. It places itself with a city-level IP lookup instead, falling
back to the browser's timezone, and then to a search box for typing a town by
hand — which is also how the detected place is corrected.

### On `scripting` and the two AI usage widgets

The Claude and ChatGPT usage widgets show the user their own limits — spend,
rate-limit windows and reset times — as those services already show them. They
work without an API key by reading the session the user is already signed in to,
which is why they need `scripting` and one host.

A refresh, and only a refresh, does this: the service worker finds an existing
tab on `claude.ai` or `chatgpt.com`, or opens one in the background, calls
`chrome.scripting.executeScript` on that tab with a single function that requests
the provider's own usage endpoint, and closes the tab again if it opened one. The
reply is validated against a Zod schema and cached locally. See
`readProviderUsage` in `src/background/service-worker.ts` and the two adapters in
`src/features/widgets/llm/`.

What keeps this narrow:

- `scripting` is **optional** and unused until a usage widget is added. It is
  requested together with `tabs` and that one provider's origin, in one prompt,
  at the moment the widget is added.
- The injected function is a static part of the bundle, not remote code, and it
  is the only thing ever injected. There are still no content scripts, so nothing
  runs on any page at any other time.
- Only the two provider origins are reachable. Neither is covered by the broad
  feeds pattern below, because both are declared by name.
- Only usage figures are read — percentages, amounts and reset times. Nothing
  from conversations, prompts or account details is read or stored.
- Nothing leaves the device. The reading is written to `chrome.storage.local` and
  rendered; it is not transmitted anywhere, including to us.

### On search suggestions and the engine endpoints

The search box has always drawn suggestions from the user's own tabs, tiles,
bookmarks and history. It now also asks the chosen engine for its completions,
which is the one place in the extension where something typed leaves the device
before the user has committed to a search.

`suggestqueries.google.com` is the only **required** host permission, because
Google is the default engine and completions are on by default. Declaring it
optional would mean a permission prompt interrupting the first search a user
ever types. Every other engine's endpoint is optional and requested the first
time that engine is selected.

What keeps this narrow:

- It is a switch. **Search → web suggestions** turns the whole second source
  off, Google included, and the box then behaves exactly as it did before:
  local sources only, nothing sent anywhere as you type.
- Nothing is sent for input that was never going to be a search. Arithmetic
  goes to the calculator and an address goes to the address matcher, and both
  are excluded before any request is made, as is a query of one character.
- The request is the engine's own public autocomplete endpoint — the same one
  the browser's address bar calls for that engine — carrying the typed query
  and nothing else. No identifier of ours is attached.
- What comes back is a list of strings, rendered below the local suggestions
  and never stored.
- Submitting a search navigates to the chosen engine, exactly as the address
  bar would.

The endpoints and the gate are in `src/features/search/suggest.ts`.

### On the broad `https://*/*` optional host pattern

The feeds widget reads RSS and Atom feeds at addresses only the user knows, so
there is no fixed list of origins to declare. Chrome will only grant a runtime
origin request if the origin matches something in `optional_host_permissions`,
which is why the broad pattern is declared.

What matters is that it is **optional and never requested wholesale**:

- Nothing is granted at install. `chrome.permissions.getAll()` on a fresh install
  returns no origins at all.
- Adding a feed calls `chrome.permissions.request` for that feed's origin alone —
  `https://example.com/*`, not `https://*/*` — so the user sees and approves one
  named site per feed.
- A user who never adds a feed never grants a single host permission.
- There are no content scripts, so a granted origin is only ever used for the
  `fetch` of that feed's XML in `src/features/widgets/feed/api.ts`.

## Data handling disclosures

- **No data is collected, transmitted or sold.** There is no analytics, telemetry
  or crash reporting of any kind.
- Settings, tiles, notes and tasks are stored locally in `chrome.storage.local`.
- Wallpapers and custom tile images are stored locally in IndexedDB and are never
  uploaded.
- Browser data read through the optional permissions above is used only to render
  the page and never leaves the device.
- Outbound requests are limited to the cases below, each behind a widget the user
  added and a host permission the user granted:
  `api.open-meteo.com` (the coordinates of a chosen place),
  `get.geojs.io` or `ipwho.is` (nothing but the request itself, answered with an
  approximate city; called once, while the weather widget is being set up),
  `api.coingecko.com` (a list of coin ids and a currency code),
  the feed addresses the user entered,
  and `claude.ai` or `chatgpt.com` (that provider's own usage endpoint, requested
  from within a tab on that site, so it carries the user's existing session for
  that site exactly as loading the page normally would — and nothing else).
  No request carries an identifier of ours, and responses are cached locally to
  keep the request count low.
- The search box draws suggestions from local tabs, bookmarks, history and tiles,
  and also asks the chosen engine for its own completions. That second source
  sends the typed query to that engine's public suggestions endpoint, and only
  when the query is neither arithmetic nor an address. It can be turned off under
  Search, and every engine but Google needs its endpoint permission granted
  first. Submitting a search navigates to the chosen engine, exactly as the
  address bar would.

## Assets

`npm run marketing:shots` writes the 1280x800 store screenshots to
`marketing/screenshots/`, captured from the built extension in a real extension
context — so the favicons and the new tab override are exactly what a reviewer
will see. It writes a wider set of scenes to `marketing/site/img/` for the
website at the same time. `npm run marketing:promo` writes the promo tiles.

Every scene runs against a throwaway profile seeded for the shot: invented tabs,
bookmarks and history, a calendar and an RSS feed served from localhost, and a
wallpaper generated by `scripts/gen-wallpaper.mjs` rather than downloaded. No
real browsing data appears in any image.

The store allows five screenshots. These are them, in order:

- [x] `wallpaper.png` — a photograph behind glass panels, the accent drawn out
      of the sky
- [x] `dashboard.png` — the author's own widget layout: calendar day view,
      clock, tasks, open tabs, weather and Claude usage
- [x] `speed-dial.png` — the tile grid, logos in their own brand colours
- [x] `command-palette.png` — the command palette over the tiles
- [x] `make-it-yours.png` — light palette, square corners, neutral plates,
      showing how far the appearance settings go

The two AI usage widgets are captured for the website too, as a `llm-usage`
scene: both providers at three footprints, with readings seeded into the cache
the panel reads and the permissions genuinely granted in a throwaway profile, so
no real account is involved.

The settings page is captured too, but for the website rather than the store:
five is the cap, and a screenshot of a preferences list sells the extension less
well than any of the above.

- [x] 440x280 small promo tile — `marketing/promo/small-tile-440x280.png`
- [x] 1400x560 marquee tile — `marketing/promo/marquee-1400x560.png`
- [x] Store description — `marketing/LISTING.md`

Screenshot content is curated rather than captured from a real profile: the
tiles are well-known sites and the widget content is written for the shot, so
no personal bookmarks, history or downloads appear on a public listing.
