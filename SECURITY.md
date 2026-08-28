# Security policy

## Reporting a vulnerability

Please report security issues privately, not as a public issue.

Use GitHub's private reporting: go to the
[Security tab](https://github.com/thepropotato/open-slate/security/advisories/new)
and open a draft advisory. That stays between you and the maintainer until a fix
is out.

Useful things to include: what an attacker can do, the steps to reproduce it,
your Chrome and extension versions, and whether it needs any optional permission
to have been granted.

Expect an initial reply within a week. If a fix is warranted, you will be
credited in the release notes unless you would rather not be.

## Supported versions

This is a single-track project: fixes go into the latest release, which is what
the Chrome Web Store serves. There are no maintained older branches.

## Scope

The extension replaces the new tab page. It has no backend, no accounts and no
telemetry, so most of the interesting surface is local:

- **Stored data.** Settings and tiles live in `chrome.storage`; wallpapers and
  uploaded media live in IndexedDB. Anything that lets another extension or a
  web page read or write those is in scope.
- **Injection through user content.** Tiles, notes, feeds and calendar
  subscriptions all render user-supplied strings and remote data. Anything that
  turns that into script execution is in scope, and the feed and ICS parsers are
  the places to look first.
- **Permission escalation.** The extension installs with `storage`, `favicon`,
  `alarms` and `topSites`; tabs, history, bookmarks, downloads, sessions and the
  weather host are optional and requested per widget. Anything that reaches data
  covered by a permission that was never granted is in scope.
- **Outbound requests.** Four are possible, all behind a widget you added:
  weather, a one-off city lookup, coin prices, and the feeds you subscribed to.
  Any request beyond those, or one that carries an identifier, is a bug worth
  reporting.

Out of scope: anything requiring physical access to an unlocked machine, and
findings against the sites the extension links out to rather than the extension
itself.
