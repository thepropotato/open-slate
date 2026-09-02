# Working on Open Slate as an agent

The code is not the whole product. The same facts are written down in the
README, the store listing, the marketing site and the changelog, and a feature
that lands without them is a feature that starts contradicting its own
documentation the moment it ships.

This has already happened here. The ChatGPT usage widget landed in `953d4c4`;
the README, `STORE.md` and the listing still said fifteen widgets until
`33da0cf`, six commits later, and the website until `1bc0fa4`. Nothing was
broken, and everything published about the extension was wrong for a day.

So: **a change is finished when the references agree with it**, not when the
code runs. That applies to the smallest addition - one search engine, one clock
face, one permission - because those are exactly the ones that feel too small to
document and silently rot the counts.

## After any change, before you call it done

```sh
npm run check
```

Typecheck, lint, the unused-icon check, the facts check and the self-test. CI
runs the same command. The facts check is the one that matters here: it reads
the real numbers out of the code and fails if any published copy disagrees.

If it fails, **fix the copy, not the check.** The check reporting `widgets = 18`
means you added a widget and the prose still says seventeen. Editing
`scripts/check-facts.mjs` to expect the old number defeats the entire point.
Only touch the claims in that file when copy has genuinely been reworded and the
anchor no longer matches.

## What to update, by what you changed

Work down this table for whatever you touched. Most changes hit two or three
rows, not all of them.

| If you added or changed | Update |
| --- | --- |
| A widget | [`README.md`](README.md) (the widget list and its count), [`marketing/LISTING.md`](marketing/LISTING.md), [`marketing/site/index.html`](marketing/site/index.html) (the `.proof` block and the widgets section), [`CHANGELOG.md`](CHANGELOG.md) |
| A search engine, clock face, palette or wallpaper kind | The `.proof` block in [`marketing/site/index.html`](marketing/site/index.html), and any prose quoting the count |
| A permission, or a new host in the manifest | [`STORE.md`](STORE.md) - every permission needs a justification a reviewer can act on, and new tab overrides are reviewed by hand |
| A network request to a new origin | [`STORE.md`](STORE.md) and the privacy sections of [`marketing/site/index.html`](marketing/site/index.html) and [`marketing/site/privacy.html`](marketing/site/privacy.html). The site claims each request is one the user asked for; keep that true |
| Anything a user would notice | [`CHANGELOG.md`](CHANGELOG.md), under `## [Unreleased]` |
| A screen that appears in the marketing images | [`scripts/marketing-shots.mjs`](scripts/marketing-shots.mjs), then `npm run marketing:shots` |

`TODO.md` also carries prose about how things work. It is notes rather than
published copy, so it is not checked automatically - but if you contradict
something written there, correct it.

## The changelog

[`CHANGELOG.md`](CHANGELOG.md) is the single source for release notes. The
GitHub release, the site's `/changelog` page and the store's "What's new" box
are all generated from it, so it is the only place release notes get written.

Add user-visible changes under `## [Unreleased]`, in the existing
Added / Changed / Fixed sections. Write for someone who uses the extension and
does not read diffs: say what is different for them, not which module moved.
Skip refactors, test-only changes and internal cleanups entirely.

Then regenerate the page, which is committed and checked in CI:

```sh
npm run site:changelog
```

## Verifying visual work

`npm run site` serves the marketing site at `http://localhost:4178` with the
same clean URLs Vercel uses, so `/privacy` and `/changelog` resolve exactly as
they do deployed.

For the extension itself, `npm run dev` serves the new tab at
`http://localhost:5178/newtab.html`. Two suites drive a real browser and are not
part of `npm run check`; run them when you touch the feed parser or widget
geometry:

```sh
npm run test:dom
npm run test:canvas
```

Do not claim a visual change works without having looked at it.

## Things to get right

- **Never invent a number.** Every count in the docs is derived from code. Run
  `npm run facts` to print the real ones rather than guessing or copying a
  figure out of nearby prose.
- **Do not weaken a claim to make it true.** The site says no analytics, no
  content scripts, and that data stays on the device. If a change would make one
  of those false, that is a reason to reconsider the change, not to soften the
  sentence.
- **Match the surrounding voice.** The docs and the interface copy are written
  plainly, in British spelling, without marketing adjectives. Comments explain
  why something is the way it is, not what the line does.
- **Say what you did not do.** If part of a task is left undone or a check was
  skipped, state it plainly rather than reporting the whole thing as finished.
