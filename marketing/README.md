# Marketing assets

Everything for the Chrome Web Store listing and the product site. **None of this
ships in the extension** - Vite only copies `public/` into `dist/`, and this
directory sits outside it. Verify with `npm run build && ls dist`.

```
marketing/
  screenshots/   1280x800 Chrome Web Store screenshots (the five `store` scenes)
  promo/         store promo tiles (440x280 small, 1400x560 marquee)
  assets/        inputs to the capture, not served
    wallpaper.png  generated; inlined into the shots as a data URL
  site/          the product site, deployed to openslate.byvenu.com
    index.html   the home page, hand-written
    site.css     the one stylesheet every page shares
    privacy.html hand-written; changelog.html and slates.html are generated
    favicon.svg
    site.js      header and scroll reveals, shared by every page
    home.js      hero slider, feature tabs, contributors
    img/         the five store scenes at 2x, the stock-tab "before", and the Open Graph image
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

Site images are cropped to their content with an even margin (`shootFramed`);
store screenshots stay exactly 1280x800. Set `fit: false` on a scene to keep
the full window.

`marketing:shots` seeds the profile before it shoots - open tabs, bookmarks and
history - and waits for fetching widgets to settle before firing, because a shot
taken mid-flight catches a spinner.

The default run shoots the five store scenes, which are also the ones the site uses.
The other scenes (Spotify, usage, clock faces and so on) are kept for reuse and only
run when named: `node scripts/marketing-shots.mjs spotify`.
