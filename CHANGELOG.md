# Changelog

Notable changes to Open Slate, newest first. Versions follow
[semantic versioning](https://semver.org), and this file is the source the
GitHub release, the website and the store listing's "What's new" all read from,
so it is written for the people who use the extension rather than for the diff.

## [Unreleased]

### Added

- Search suggestions from the engine you actually search with, on from the
  start. Google works straight away; any other engine asks for access to its
  suggestions endpoint the first time you pick it.

### Changed

- Settings open over the new tab instead of replacing it, so closing them puts
  you back where you were rather than on a blank page.
- The themed background is painted before the first stylesheet loads, so opening
  a tab no longer flashes white on the way in.

## [1.1.0]

### Added

- Claude and ChatGPT usage widgets, reading spend and rate limits from the
  session you are already signed in to. No API key, nothing about your
  conversations, and the numbers stay on your device.
- A calendar that reads ICS feeds, with a day view drawn on an hour axis and the
  meeting link pulled out of the event.
- Tasks take priorities and due dates from the line as you type it — `!` for
  priority, `@ friday` for a date — and filter down by either.

### Changed

- Anything that would destroy stored data now asks first, overwrites included.
- The wallpaper in use is named rather than merely tinted, so it is tellable
  apart from the other slides in a slideshow.

### Fixed

- An arranged layout survives being arranged, instead of being re-packed on the
  next load.
- The page scrolls as a whole and its top stays reachable, and a large tile count
  no longer divides the band indefinitely.

## [1.0.0]

First public release.

### Added

- A speed dial of tiles drawn with each site's own logo, in folders and across
  named pages, opened by position with `Alt+1`–`9`.
- A widget canvas of square cells with five standard sizes, where growing or
  dropping a widget moves whatever was in the way at every window size.
- A wallpaper engine — solid, gradient, image, video or slideshow — with dim,
  blur, brightness, saturation, zoom, vignette and slow drift.
- A search band with bang syntax and a built-in calculator, and a command palette
  over tabs, bookmarks and history.
- Widgets for the clock, weather, calendar, notes, tasks, a timer, feeds, crypto
  prices, and your own browser data.
- Settings sync, and an export and import of everything stored.

[Unreleased]: https://github.com/thepropotato/open-slate/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/thepropotato/open-slate/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/thepropotato/open-slate/releases/tag/v1.0.0
