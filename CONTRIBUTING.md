# Contributing

Thanks for taking an interest. This is a Chrome extension that replaces the new
tab page; [`README.md`](README.md) covers what it does and how the code is laid
out, and this file covers how to work on it.

## Getting set up

```sh
npm install
npm run build      # writes dist/
```

Then in Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked**
→ choose `dist/`. Rebuild and hit reload on the extensions page to see changes.

For anything that is not extension-specific, `npm run dev` is faster: it serves
the page at `http://localhost:5178/newtab.html` with hot reload. The `chrome.*`
APIs sit behind [`src/core/platform/browser.ts`](src/core/platform/browser.ts),
which falls back to `localStorage` and a public favicon service outside the
extension, so most of the interface works in an ordinary tab. Widgets that
genuinely need the browser (tabs, history, sessions, downloads) show their empty
state there.

Node 22.6 or newer. The self-test imports the TypeScript sources directly and
relies on Node's built-in type stripping, which older versions do not have.

## Before you open a PR

```sh
npm run check
```

That is typecheck, lint, the unused-icon check and the self-test. CI runs the
same command, so if it passes locally it should pass there.

Two suites need a dev server and are not part of `npm run check`, because they
drive a real browser. Run them when you touch the feed parser or widget
geometry:

```sh
npm run dev          # in another terminal
npm run test:dom     # feed and ICS parsing, in a real page
npm run test:canvas  # widgets never overlap, driven by real drags
```

The dev server is pinned to port 5178, which is where those two and `npm run
shots` look for it. Both take a base URL as an argument if you need to point
them somewhere else.

`npm run shots` renders every screen in both colour schemes into `./shots`. It
is the quickest way to see whether a change broke a layout you were not looking
at.

## House rules

A few conventions are enforced by lint, because they are easy to break by
accident:

**Icons come from the registry.** Font Awesome is only wired up in
`src/core/icons`; import `Icon` from `@/core/icons` and use `<Icon name="…" />`.
Importing `@fortawesome/*` anywhere else is a lint error.

**No emoji or symbol glyphs in the interface.** Use an icon instead. This is
also a lint error, and it applies to string literals and template strings alike.

**No semicolons**, single quotes, two-space indent. There is no Prettier config;
match the file you are editing.

Comments explain *why*, not what. The existing ones are worth skimming before
you write new ones: they tend to record the constraint that forced the code to
look the way it does.

## Adding things

**A widget** is one directory under `src/features/widgets/` and one import in
its `index.ts`. The definition in
[`src/core/widgets/types.ts`](src/core/widgets/types.ts) carries its own config
schema, the standard sizes it supports, its settings fields and any permissions
it needs; the canvas, the picker and the settings UI all read it from there.
Nothing outside the widget's directory should need to change.

Request permissions through the definition's `permissions` and `origins`, never
at install time. The extension ships with `storage`, `favicon`, `alarms` and
`topSites`, and everything else is asked for when someone adds the widget that
needs it. A PR that moves a permission into the manifest will not be merged
without a good reason: new tab overrides get a manual store review, and each
permission has to be justified in [`STORE.md`](STORE.md).

**A setting** is a field in
[`src/core/settings/schema.ts`](src/core/settings/schema.ts) plus an entry in the
matching file under `src/features/settings-ui/sections/`. The UI renders itself
from that declaration. A development-time check fails loudly if a spec path does
not exist in the schema.

**Touching the widget canvas?** The grid library only validates the breakpoint it
is currently rendering, so everything that writes a layout must go through
`normalizeLayout` in
[`src/core/widgets/layout.ts`](src/core/widgets/layout.ts), for every breakpoint.
Skipping it is how widgets end up stacked behind each other at window sizes
nobody was looking at. `npm run test:canvas` exists to catch exactly this.

## Commits and pull requests

Commit subjects are written in the imperative and say what the change achieves,
not what was edited:

```
Keep a reset out of reach of the navigation
Read the meeting link out of a calendar feed
Stop the tile count from dividing the band indefinitely
```

No `feat:` / `fix:` prefixes, no file names in the subject. If the reason is not
obvious from the subject, put it in the body.

Keep a PR to one change. If you are fixing a bug and tidying nearby code, two
commits are easier to review than one. Say what you did and why; if it is
visual, a screenshot saves a round trip.

## Reporting bugs

Open an issue with your Chrome version, your OS, and what you expected versus
what happened. For anything visual, a screenshot is worth more than a
description. If it involves a widget that reads browser data, say whether you
granted that permission.

For anything security-related, please do not open a public issue - see
[`SECURITY.md`](SECURITY.md).

## Submitting a slate

A slate is an arrangement of widgets: which ones are on the grid and where they
sit. The gallery is a folder of JSON files in `slates/`, so submitting one is an
ordinary pull request and merging it is what publishes it. There is no server
and no account.

The easiest route is from the extension. Open Settings, go to Slates and press
**Share this layout**: that opens a submission form on GitHub with your code
already filled in, which you post yourself. To open a pull request directly
instead, add one file to `slates/` named after its `id`:

```json
{
  "id": "two-columns",
  "name": "Two columns",
  "description": "Reading on the left, the day on the right.",
  "author": "your-github-username",
  "code": "ns1.…",
  "added": "2026-09-12"
}
```

Then run `npm run slates`, which validates every file and rewrites the index the
gallery reads. Commit both. CI runs the same check, so a submission that cannot
be applied never reaches review.

A slate carries no content, and that is enforced rather than trusted: the code
holds widget types and positions only, never the calendar you subscribe to, the
city your weather is set to, or your tiles and notes. Names and descriptions are
rendered in the extension and on the site, so they are held to plain text within
a length cap.

### Who a slate is credited to

`author` is your GitHub username, and on its own it is a claim rather than a
proof: it is a string in a file, and a file can say anything. What makes it mean
something is that a separate check compares it against the account that opened
the pull request, which is the one identity you cannot type in yourself. A
mismatch fails the check.

It fails rather than silently correcting the field, because submitting someone
else's layout on their behalf is legitimate. If you are doing that, leave their
name in place, say so in the description, and a maintainer can merge it with the
credit as it stands.

Submitting through the extension needs no username at all: the slate is credited
to whoever files the issue.

If you would rather not be credited as your GitHub handle, set `credit` to the
name you want shown. Your username still appears beside it, because the username
is the part that was checked and the display name is not.

Do not put an email address in a slate file. The gallery is a public folder and
its history is permanent, so an address added there could not be taken back out.
Commenting on the submission is enough to reach you.

### Without a GitHub account

Submitting needs a free GitHub account, because that account is what proves who
wrote the slate. If you do not want one, the code is still yours to share: copy
it from Settings → Slates and send it however you like. Anyone can apply it
directly, and a maintainer can open the pull request for you with the credit
left in your name.
