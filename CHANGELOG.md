# Changelog

Notable changes to Open Slate, newest first. Versions follow
[semantic versioning](https://semver.org), and this file is the source the
GitHub release, the website and the store listing's "What's new" all read from,
so it is written for the people who use the extension rather than for the diff.

## [Unreleased]

### Added

- Slate codes, which share the arrangement of your widgets the way theme codes
  already share the look. A code says which widgets are on the grid and where
  they sit, and nothing else: not the calendar you subscribe to, not the city
  your weather is set to, not your tiles or notes. Whoever applies it points the
  widgets at their own. They live in their own Slates section in settings: start
  from one, browse what others have shared, or share the one you built.
- Community slates, at openslate.byvenu.com/slates, showing what people have
  shared. Each has a preview drawn from the slate itself, so it cannot show you
  something other than what you would get. "Use this slate" opens the extension
  and shows the arrangement on your own new tab, with your wallpaper and theme,
  before anything changes; nothing is applied until you say so. Browsing asks
  nothing of the extension, which still makes no request of its own.
- Four starter slates, so a new grid does not have to begin as an empty one.
  Focus, Dashboard, Reading and Minimal each arrange a handful of widgets that
  work without any setting up. Applying one replaces your widgets and the shape
  of the page, leaves your tiles, notes and tasks alone, and asks before it does.

- Icons as an alternative to tiles: a round favicon with the title underneath,
  the shape a browser's own new tab uses. The settings that only describe a
  plate - its colour, its proportions, where the title sits on it - step aside
  while icons are on, rather than staying there doing nothing.
- A wallpaper slideshow can change on every new tab, rather than only on a
  timer. Shuffled, tabs opened together each get their own picture; in order,
  each new tab takes the next one. It is its own switch above the interval.
- "Next wallpaper" in the command palette, for when the one on screen is not
  the one you want and you would rather not wait for the timer. It offers
  itself only when a slideshow with more than one picture is running, and every
  open tab follows.

### Changed

- Arranging the page is now something you ask for, and the page is otherwise
  left alone. Tiles and widgets carried a grip and a button in their corners
  that appeared whenever the pointer crossed them, sitting on top of the favicon
  or the first line of whatever a widget was drawing. Those are gone. Press the
  grid button beside the settings cog, right-click and choose Arrange, or press
  E, and everything loosens at once: drag a tile or a widget from anywhere on
  it, resize from the corner, and press Done or Escape when you are finished.
- Right-click now opens a menu wherever you are on the page, with what belongs
  to the thing under the pointer first - open a tile in a new tab, edit it,
  remove it, configure a widget - and adding, arranging and the settings below
  it. Nothing needs to be scrolled to any more.
- Widgets stay live until you arrange them. A widget's face answers clicks, so
  a drag that started on it would have stolen them; arranging settles that by
  holding the whole board still for as long as you are moving things.

### Fixed

- Sync no longer throws away what you are in the middle of changing. A copy
  pulled from another device replaced everything, unsaved edits included, so
  with sync on the settings panel could reset itself at any moment. A pull now
  keeps your edits and brings the rest.
- Settings changed while the panel is open no longer undo work done beside
  them. Saving wrote the whole panel back, including its copy of things it does
  not edit, so a picture added to the slideshow could vanish the moment an
  unrelated switch was saved. Only what you actually changed is written now.
- A wallpaper that cannot be read no longer costs you the rest of the section.
  One bad value used to discard everything about the background, uploaded
  pictures included; now only the value itself falls back to its default.
- The search box no longer shifts as you type. The shortcut hint, the Go chip
  and the clear button used to appear and disappear around the input, changing
  its width on the first keystroke and again once what you had typed looked like
  a link. They now hold their places whether or not they are showing.
- Choosing a wallpaper while settings are open now shows up straight away, on
  both the preview and the page behind it. It was being applied but left hidden
  behind the settings you had not saved yet, so a picture you had definitely
  chosen appeared to do nothing until you saved or closed the panel.
- A calendar that will not load now says why. A work calendar that answers with
  a sign-in page instead of a calendar, an address that has been reset, and a
  site that cannot be reached are three different problems, and "check the
  address" was the wrong advice for the one where the address is correct.
- A calendar shared as free or busy only now says so, rather than showing a day
  of meetings all called "Busy" with nothing to click. The titles and joining
  links are removed before the calendar ever reaches the browser, so the widget
  now explains that and points at the sharing setting that controls it.

## [1.2.0]

### Added

- A Spotify widget: the track, the artist, how far through it you are, and play,
  pause and skip. The buttons reach whichever device is actually playing - your
  phone or the desktop app, not only this browser - so you can change the song
  without going to find the tab. When nothing is playing it shows the last track
  you played, and pressing play picks up on the device you left off on, asking
  which one if there is any doubt. Starting and skipping need Spotify Premium,
  and seeing what is playing does not. It asks Spotify only while the tab is in
  front of you.
- A connectors page, built into the extension, for the setup that has to happen
  outside it. Spotify grants playback access per registered application and its
  free tier covers only a handful of named testers, so the widget walks you
  through creating your own instead: the page links to the right place, gives you
  the exact line to paste, and takes the client ID at the end. About two minutes,
  once. Nothing is registered on your behalf and no credentials ship in the
  extension, so the access is yours to revoke whenever you like.
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
- Tasks take priorities and due dates from the line as you type it - `!` for
  priority, `@ friday` for a date - and filter down by either.

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
- A wallpaper engine - solid, gradient, image, video or slideshow - with dim,
  blur, brightness, saturation, zoom, vignette and slow drift.
- A search band with bang syntax and a built-in calculator, and a command palette
  over tabs, bookmarks and history.
- Widgets for the clock, weather, calendar, notes, tasks, a timer, feeds, crypto
  prices, and your own browser data.
- Settings sync, and an export and import of everything stored.

[1.2.0]: https://github.com/thepropotato/open-slate/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/thepropotato/open-slate/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/thepropotato/open-slate/releases/tag/v1.0.0
