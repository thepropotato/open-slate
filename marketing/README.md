# Marketing assets

Everything for the Chrome Web Store listing and the product site. **None of this
ships in the extension** — Vite only copies `public/` into `dist/`, and this
directory sits outside it. Verify with `npm run build && ls dist`.

```
marketing/
  screenshots/   1280x800 Chrome Web Store screenshots (the five `store` scenes)
  promo/         store promo tiles (440x280 small, 1400x560 marquee)
  assets/        inputs to the capture, not served
    wallpaper.png  generated; inlined into the shots as a data URL
  site/          the product site, deployed to openslate.byvenu.com
    index.html   single page, no build step, no dependencies
    favicon.svg
    img/         every scene at 2x, plus the Open Graph image
  LISTING.md     paste-ready store listing copy
```

## Regenerating

```sh
npm run marketing:shots  # builds, draws the wallpaper, writes every scene
npm run marketing:promo  # promo/ and site/img/og.png
```

`marketing:shots` runs `npm run build` and `npm run gen:wallpaper` first, so it
is the only command needed. Pass scene names to redo just those:

```sh
node scripts/marketing-shots.mjs clock-faces folders
```

`marketing:shots` seeds the profile before it shoots — open tabs, bookmarks and
history — and waits for fetching widgets to settle before firing, because a shot
taken mid-flight catches a spinner.

The store takes the five scenes marked `store: true`; the site takes all
fourteen. That gap is the point: a page showing three variations of the same
dark tile grid undersells an extension whose whole pitch is how far it bends.

`marketing:shots` drives the built extension in a real Chrome with Playwright,
so favicons come from Chrome's own cache and the new tab override is exactly
what a reviewer sees.

The content is **curated, not personal**: tiles are well-known sites, the task
list and note are written for the shot, and no real bookmarks, history or
downloads appear anywhere. Rerunning on any machine produces the same images,
give or take the clock and the weather.

These details in `scripts/marketing-shots.mjs` are worth knowing before editing
it — each one is a trap that has already been fallen into once:

- **Widget columns.** A cell narrower than `MIN_CELL` (120px) collapses the
  whole canvas into a single stacked column — which is what a scene that came
  back as one enormous widget means. At `maxWidth: 1240` that caps you at about
  eight columns; the clock-faces sheet asks for ten and has to narrow its band
  instead.
- **`limit` has a floor.** The Open tabs widget's schema is
  `z.number().min(5)`, so a `limit` of 4 is rejected and zod restores the
  default of 14 — and the capture's own `newtab.html` appears in the shot under
  a raw extension id. The fix is to seed one more tab than the limit shows: the
  capture page is opened last and `chrome.tabs.query` answers in window order,
  so it falls off the end.
- **The capture visits its own page.** Opening `newtab.html` is the only way to
  reach the extension's APIs, and that visit lands in history. It is deleted
  again in `seedBookmarks` — otherwise History and the palette both list
  "Open Slate" above the seeded rows.
- **Three widgets cannot be filled.** Downloads needs files actually downloaded,
  Recently closed needs `chrome.sessions` to hold something, and Most visited
  reads `chrome.topSites`, which a fresh profile answers with the Web Store and
  nothing else. They are left out of the gallery and carried by the copy.
- **Folder previews look plain, and that is real.** A folder draws its
  children's *favicons* from Chrome's cache, with no brand-logo path of the kind
  an ordinary tile has. A throwaway profile has never visited those sites, so
  the cache is empty. Only a real profile fills them.
- **The dashboard scene serves a calendar.** The calendar's day view only
  exists once a feed is subscribed, so the run starts a throwaway HTTP server
  on localhost with three invented events and grants that origin. A `data:` URL
  will not do: it has no origin, so the widget's permission check always fails
  on one. Nothing of the author's real subscriptions is involved.
- **Live scenes patch the manifest.** `permissions.request` needs a user gesture
  that a capture run cannot produce, so a scene needing an optional permission
  launches against a throwaway copy of `dist/` with that permission promoted
  from optional to required. The shipped build is never touched.
- **The wallpaper is drawn, not downloaded.** `scripts/gen-wallpaper.mjs` writes
  a dusk scene straight into an RGBA buffer and encodes it with zlib, the way
  `gen-icons.mjs` draws the icons — no image dependency, no licence, and
  byte-reproducible anywhere. It is inlined into the scenes as a data URL, which
  both `useBackgroundSource` and the accent sampler accept, so one string drives
  the wallpaper and the colour drawn out of it. The wallpaper *settings* scene
  is the exception: it writes the image into IndexedDB instead, because
  `image.url` is rendered verbatim into the "Image address" field and a 4MB
  base64 string across that box is not what the section looks like in use.

## The site

Static, single file, no build step. Deploy `site/` to any host and point
`openslate.byvenu.com` at it.

Before launch, set `STORE_URL` in the inline script at the bottom of
`site/index.html` to the published listing. While it is empty, every "Add to
Chrome" button reads "Coming to the Chrome Web Store" and is inert, rather than
linking somewhere that does not exist.

- Palette: Paper & Ink — `#FAF9F6` page, `#1A1917` ink, `#2F5D50` accent
- Type: Instrument Serif for headings, Inter for body — the only two faces used
- Tagline: *Your most-opened page, finally yours.*
