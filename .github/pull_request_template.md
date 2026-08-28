<!--
Thanks for the patch. CONTRIBUTING.md has the conventions if you have not read
it; the short version is that `npm run check` should pass and commit subjects
say what the change achieves.
-->

## What this changes

<!-- And why. If it fixes an open issue, "Fixes #123" here will close it. -->

## How you tested it

<!--
`npm run check` at minimum. If you touched the feed parser or widget geometry,
say whether you ran the browser suites:

  npm run dev
  npm run test:dom
  npm run test:canvas
-->

## Screenshots

<!-- For anything visual. Both colour schemes if it is a theming change. -->

## Checklist

- [ ] `npm run check` passes
- [ ] Icons come from `@/core/icons`, and there are no emoji in the interface
- [ ] Any new widget declares its own config, sizes, fields and permissions
- [ ] Anything writing a widget layout goes through `normalizeLayout`
- [ ] No new install-time permission, or the reason for one is explained above
      and `STORE.md` is updated to justify it
