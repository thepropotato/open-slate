# A wallpaper that changes on every new tab

**Date:** 2026-09-13
**Status:** Approved

## Problem

A slideshow wallpaper only advances on a timer. `intervalMinutes` has a floor of
1, and the step is taken by an alarm in the service worker, so every tab opened
inside that minute shows the same image.

For a new tab page that is the wrong unit. The page is opened dozens of times a
day, and "a different wallpaper each time I open one" is a more natural reading
of a slideshow here than a wall clock is. There is no way to ask for it today.

The setting cannot express it either: the cadence is a duration, and no duration
means "when I open a tab".

## Shape of the work

`intervalMinutes` gains `0`, meaning *every new tab* rather than a length of
time. One bound in the schema, one branch in the page hook, one condition in the
service worker, one label in the settings panel.

No new schema field and no migration: the setting already answers "how often
does this change", and zero is the fastest point on that scale.

## Non-goals

- Changing the wallpaper on any other event (focus, navigation, a timer *and* a
  new tab together).
- A per-tab override, or remembering which image a given tab showed.
- Any change to how the background renders, or to the video and image types.

---

## Section 1 - The setting

```ts
// schema.ts, in Background.slideshow
intervalMinutes: z.number().min(0).max(1440).default(30),
```

The slider's lowest stop becomes 0 and the field is relabelled, since "Change
every / on every new tab" does not read:

```ts
{
  path: 'background.slideshow.intervalMinutes',
  label: 'Change',
  control: {
    kind: 'slider',
    min: 0,
    max: 1440,
    format: (v) =>
      v === 0
        ? 'on every new tab'
        : v < 60
          ? `every ${v} min`
          : `every ${Math.round((v / 60) * 10) / 10} h`,
  },
}
```

Every non-zero value keeps its current meaning, so an existing setting is
untouched by the change.

## Section 2 - How a tab picks its slide

In `useSlideshowCursor` (`src/features/background/useBackgroundSource.ts`), zero
takes a separate path: the tab decides once on mount and does not subscribe to
the shared cursor at all.

| Shuffle | Behaviour at `0` |
|---|---|
| on (default) | A random index, chosen on mount. Nothing is written. |
| off | The stored cursor plus one, written back, so successive tabs step through the set in order. |

Tabs deliberately do not coordinate. Opening several at once gives several
different wallpapers, which is the point: each tab is its own fresh page. The
cost is that with shuffle **off**, two tabs opened in the same instant may read
the same stored cursor and land on the same image. With shuffle on - the default
- they will not, and that is the case that matters when a session is restored.

The existing behaviour for non-zero intervals is unchanged: read the cursor from
storage, subscribe to it, and let the worker move it.

The dev fallback timer (`!isExtension()`) is skipped at `0`, since there is no
interval to run.

## Section 3 - The service worker

`syncSlideshowAlarm` treats `0` the same as an inactive slideshow and clears the
alarm:

```ts
const minutes = settings.background?.slideshow?.intervalMinutes ?? 30
if (!active || minutes === 0) {
  await chrome.alarms.clear(SLIDESHOW_ALARM)
  return
}
```

There is no timer to run, so the worker does nothing at all on this setting -
slightly better for battery than the current minimum of one minute.

`advanceSlideshow`, `pickDifferent` and the `slideshowCursor` key are unchanged.

---

## Testing

| Area | What is verified |
|---|---|
| Alarm | `intervalMinutes: 0` clears the alarm rather than creating a 1-minute one; a non-zero value still creates one at that period |
| Ordered advance | A tab at `0` with shuffle off starts from the stored cursor, advances by one, and writes it back |
| Shuffled pick | A tab at `0` with shuffle on picks an index within range and writes nothing |
| Unchanged path | A non-zero interval still reads the cursor from storage and subscribes to changes |
| Degenerate set | A slideshow of one image does not move, at any setting |
| Schema | `0` parses; `-1` does not |

Plus `npm run check`.

## Risks

- **Two tabs opened together with shuffle off can match.** Accepted: the
  alternative is a shared write and a race, and shuffle is on by default.
- **`0` as "every new tab" is a slight overload of a duration field.** Accepted
  in exchange for no new schema field and no migration; the slider's own label
  carries the meaning.
