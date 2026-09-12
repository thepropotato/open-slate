# Predictable interaction: context menus, a steady search bar, and icon tiles

**Date:** 2026-09-13
**Status:** Approved

## Problem

Three complaints, one theme — the page does not behave the way a desktop surface is expected to behave.

1. **Reaching the controls costs a scroll.** Both "Arrange" and "Add widget" sit at the *bottom* of their band, below the full grid, and are invisible until hovered. Worse, entering arrange mode reserves an extra grid row, which pushes the "Done" button further down — the act of clicking Arrange can move its own exit off-screen.
2. **The search bar shifts as you type.** The input's width jumps on the first keystroke and again mid-typing.
3. **Tiles are the only option.** Plates suit some people; others want the Chrome new-tab shape — a favicon with a label under it.

## Shape of the work

Four changes, only loosely coupled. Sections 2 (search) and 3 (icon tiles) touch nothing Section 1 touches and can land in any order. Section 4 (empty states) depends on Section 1 only for the menu it points at, and its prompt buttons work standalone. Section 1 is the largest and the only one that deletes existing UI.

## Non-goals

- Per-tile sizes (1×1 / 2×2 mixed on one grid). Considered and deferred; this spec only adds a *global* style switch.
- Any change to the settings overlay, the palette's search behaviour, or the widget size system.
- A permanent on-page toolbar. The page's value is that it is clean at rest.

---

## Section 1 — A context menu as declared data

A new feature directory, `src/features/menu/`, holding one `ContextMenu` component and a `MenuItem` type. The menu is *data*, following the precedent of `PaletteAction` in `src/features/palette/actions.ts:19-24`, so one list drives rendering, keyboard navigation, and (where it makes sense) the palette.

```ts
type MenuItem = {
  id: string
  label: string
  icon?: IconName
  onSelect: () => void
  danger?: boolean
  separatorBefore?: boolean
}
```

Each band builds its own list at the point of the event:

| Band | Items |
|---|---|
| Tiles (grid) | Add a tile · New folder · — · Arrange tiles · — · Settings… |
| Tiles (on a tile) | Open in new tab · — · Edit… · Remove · — · then the grid items |
| Widgets (canvas) | Add a widget · — · Arrange widgets · — · Settings… |
| Widgets (on a widget) | Configure… · Remove · — · then the canvas items |

Per-item actions come first because they are the more specific target.

### Mechanics

- `onContextMenu` on the band container; `preventDefault()`. The handler walks `event.target.closest('[data-tile-id]')` / `[data-widget-id]` to decide whether to prepend per-item actions.
- Positioned at the pointer, flipped horizontally and vertically when within one menu-dimension of the viewport edge.
- Rendered through a **portal** to `document.body`, so no band's `overflow` or `contain` can clip it.
- Dismissed on: Escape, outside pointerdown, scroll, and window blur.
- `role="menu"` with `role="menuitem"` children; Arrow Up/Down move focus, Home/End jump, Enter/Space select, and focus returns to the previously focused element on close.
- Right-click **outside** any band falls through to the browser's native menu, so reload and view-source remain available.

### What is removed

- The trailing toolbar in `src/features/widgets/WidgetCanvas.tsx:299-324` and its CSS (`widgets.css:220-257`).
- The trailing toolbar in `src/features/tiles/TileGrid.tsx:220-242` and its CSS (`tiles.css:272-306`).
- `EDIT_ROOM_ROWS` (`WidgetCanvas.tsx:59`) and its `minHeight` application (`:148, :248`) are **unchanged**. The extra row is still wanted while arranging, as somewhere to drop a widget below the last one. What changes is only that nothing the user must reach now sits beneath it, so growing the stage no longer pushes an exit off-screen.

### Exiting arrange mode

With the toolbars gone, arrange needs an exit that does not depend on scroll position:

- **Escape** leaves arrange mode in both bands (before the palette/overlay handlers see it, and only when no menu or dialog is open).
- A small **fixed "Done" pill**, adjacent to the settings cog at `App.css:136-141`, mounted **only while a band is arranging**. This is the single piece of transient chrome the design adds, and it exists because an exit must always be reachable.

### Arrange mode becomes transient

Today the two bands disagree: widgets persist `widgets.locked` to settings, so a reload can open a tab already jiggling; tiles use local `useState` and reset. Right-click makes re-entering arrange cheap, so persistence no longer earns its cost.

- `TileGrid` keeps its local `useState` (`TileGrid.tsx:40`) — unchanged.
- `WidgetCanvas` gains an equivalent local `editing` state. `widgets.locked` **stays in the schema** (removing it would need a migration for no user-visible gain) but is no longer written when the user toggles arrange; it is read once as the initial value and otherwise ignored.
- Adding a widget still force-unlocks (`WidgetCanvas.tsx:196`), now by setting local state rather than writing settings.

### Palette additions

`buildActions` gains `tiles:add`, `tiles:arrange`, and `widgets:add`. `widgets:arrange` already exists at `actions.ts:67-73` and is rewired to the new local state via a callback passed down, since the palette can no longer flip a setting to achieve it.

**Design note:** the palette and the fixed "Done" pill live in `App`; arrange state now lives inside each band. Lifting arrange state up to `App` would mean threading transient band state through `PageShell`, which is reused verbatim by the settings preview and is documented to take only "anything a picture of the page must not do" as props (`PageShell.tsx:14`).

Instead, `App` owns a single `BandCommands` ref — `{ tiles?: {...}, widgets?: {...} }` of callbacks plus an `arranging` flag — and passes it down through `PageShell` as one optional prop. Each band populates its slot on mount and clears it on unmount. The preview passes nothing, so the preview's bands register nowhere and the preview gains no interactive behaviour. `App` subscribes to changes via a `useSyncExternalStore`-style notifier on the ref so the "Done" pill can appear and disappear without the bands re-rendering `App`'s whole tree.

---

## Section 2 — A search bar that does not move

The dropdown is already correct — it is absolutely positioned precisely so it cannot shove the tiles down (`SearchBar.css:71-74`). The shift is **horizontal, inside `.search__row`**, caused by three flex siblings being *mounted and unmounted* around a `flex: 1` input (`SearchBar.tsx:147-177`):

| Control | Mounted when | Width |
|---|---|---|
| `search__hint` (`/` `⌘K`) | `commandPalette && !value` | ~70px |
| `search__chip` ("Go") | the text parses as a URL | ~46px |
| `search__clear` | `value` is non-empty | ~24px + gap |

On the first keystroke the hint vanishes and the clear button appears at once — a net width change with no transition. Typing further, until the text parses as a URL, moves it again.

### Fix: reserve the space

All three stay mounted at all times. Visibility is expressed with `opacity` and `visibility: hidden`, never by unmounting, so each keeps its layout width:

- `search__hint` renders whenever `behavior.commandPalette` is on, hidden when `value` is non-empty.
- `search__chip` always renders, hidden unless `destination` is truthy.
- `search__clear` always renders, hidden and `disabled` unless `value` is non-empty — `disabled` matters so it cannot be tabbed to or clicked while invisible.

`aria-hidden` tracks visibility on each, so a screen reader is not told about a "Clear" button that does nothing.

The hint and the chip are never visible simultaneously — one needs an empty box, the other a non-empty one — so they share one slot rather than each reserving width, which would otherwise add ~46px of permanent dead space to the resting bar.

The slot is a `position: relative` wrapper containing both, each `position: absolute; inset: 0` and centred, so neither sizes it. The wrapper's own width comes from CSS — a `min-width` in `ch` units wide enough for the longer of the two strings.

This matters because `behavior.commandPalette` can be off, in which case the hint never renders and a slot sized by its children would collapse, letting the chip shift the input after all. Sizing the wrapper independently of its contents makes the slot's width the same in every configuration.

When the palette is off the slot still reserves its width, holding only the chip. That is a deliberate trade: a few tens of pixels of dead space in one configuration, in exchange for one code path and a bar that never moves.

A short `opacity` transition (~120ms, respecting `appearance.animations`) makes the swap read as a fade rather than a flicker.

### The vertical nudge

`.search__row` uses `minHeight: search.height` (`SearchBar.tsx:128`), so any content taller than the setting grows the row and pushes the bands below. Changed to a fixed `height`, with the row's children constrained to fit. `search.height`'s slider range already guarantees room for a `<kbd>` chip.

---

## Section 3 — Icons as an alternative to tiles

One new setting; every tile follows it.

```ts
// schema.ts, in the Tiles group
tileStyle: z.enum(['plate', 'icon']).default('plate')
```

Applied as `data-tile-style` on the tiles container alongside the existing `data-*` attributes (`TileGrid.tsx:164-167`), and selected in `tiles.css`. This is deliberately the same mechanism as `plateStyle`, `labelVisibility`, and `hoverEffect` — a new *value* in an established pattern, not a new pattern.

### What `icon` changes

| | `plate` (today) | `icon` |
|---|---|---|
| Plate | visible surface, `aspect-ratio: var(--tile-aspect)` (default 1.75) | none — transparent, square |
| Artwork | inside the plate, padded | a circle, centred |
| Label | inside the plate, per `labelPlacement` | always below the circle, centred |
| Track width | `tiles.width` | derived: the circle's diameter plus label room |

In `icon` mode the CSS overrides `--tile-aspect` to `1`, zeroes the plate's background and border, and rounds the artwork to a circle. Label placement is forced below and centred — a label inside a transparent square is just floating text, so `labelPlacement` and `labelAlign` are ignored here rather than producing broken combinations.

### Settings that stop applying

`plateStyle`, `labelPlacement`, `labelAlign`, and `aspect` have no meaning without a plate. Each of their `Field` specs in `sections/tiles.tsx` gains a `when: (s) => s.tiles.tileStyle === 'plate'` guard — the `Field` type already supports this (`types.ts:47-59`), so they simply disappear from the settings panel in icon mode instead of sitting there doing nothing.

`labelVisibility` still applies (a label can hide on hover in either style). `width`, `gap`, `radius`, `imageFit`, `imagePadding`, and `hoverEffect` all still apply, `radius` becoming a no-op only because the circle overrides it.

### Per-tile overrides

`Tile.labelPlacement` and `Tile.background` (`schema.ts:51-66`) are both plate concepts. In icon mode both are ignored. No schema change and no migration: the values stay on disk and resume working if the user switches back.

---

## Section 4 — Empty states

Right-click is invisible. A user with no tiles who does not know the menu exists has nothing to click at all. So the invitation lives in the empty space, where it costs nothing once there is content:

- **Tiles band, no tiles on the current page:** a dashed placeholder reading "Add a tile", which opens the tile editor, with "or right-click for more" beneath it in muted text.
- **Widgets band, no widgets:** the same shape, reading "Add a widget", opening the existing picker (`setPicking(true)`).

Both unmount entirely as soon as the band has content. They are the only always-visible affordance the design adds, and only in the one state where the page would otherwise be blank.

`tiles.showAddButton` (the trailing `+` cell, `TileGrid.tsx:190-200`) is **kept as-is** — it is an existing preference, it is off nobody's critical path, and removing it would take away a working route for people who already rely on it.

---

## Testing

| Area | What is verified |
|---|---|
| `MenuItem` list building | Right-click on a tile yields tile actions before grid actions; right-click on bare grid yields only grid actions; a folder tile yields no "Open in new tab" |
| Menu positioning | Flips at each viewport edge; stays within bounds |
| Menu dismissal | Escape, outside click, scroll, blur each close it; focus returns to the prior element |
| Menu keyboard | Arrows wrap, Home/End jump, Enter selects, Tab does not escape the menu |
| Native menu preserved | `contextmenu` outside any band is not prevented |
| Arrange transience | Toggling arrange on widgets does not write settings; a remount starts locked |
| Escape in arrange | Leaves arrange mode; does not also close an open menu and the mode in one press |
| Search width stability | `.search__row`'s input width is identical at rest, after one keystroke, and with a URL typed |
| Search a11y | The clear button is `disabled` and `aria-hidden` while invisible |
| Search height | Row height equals `search.height` regardless of chip content |
| `tileStyle` | `data-tile-style` reflects the setting; plate-only fields are absent from the settings panel in icon mode |
| Per-tile overrides | A tile with `labelPlacement` set renders identically to one without, in icon mode |
| Empty states | Present when a band is empty, absent when it has content; the tiles prompt respects the current page |

Plus `npm run check` — `facts:check` will flag the README, `STORE.md`, and marketing site if the new setting changes a published count (`AGENTS.md:24-32`).

## Risks

- **Right-click is a learned gesture.** Mitigated by empty states and palette actions, but some users will never discover the menu. Accepted: the alternative is permanent chrome, which is the thing this page is trying not to have.
- **Escape is getting crowded** — it already clears the search box, closes the palette, and closes the overlay. The arrange handler must be ordered last and must no-op when anything else is open.
- **Icon mode plus a wide `tiles.aspect`** is a combination a user can reach by setting aspect in plate mode and then switching. Overriding `--tile-aspect` in CSS rather than reading the setting avoids it.
