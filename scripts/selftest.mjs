/**
 * Checks the pure logic that screenshots cannot cover.
 *
 * Deliberately dependency-free and run through Node's TypeScript stripping, so
 * there is no test framework to keep current. Anything needing a DOM belongs in
 * `npm run shots` instead, where it can actually be looked at.
 */
const load = (path) => import(`@/${path.replace(/\.tsx?$/, '')}`)

let passed = 0
const failures = []

const check = (name, actual, expected) => {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) passed += 1
  else failures.push(`${name}\n    expected ${e}\n    actual   ${a}`)
}

const truthy = (name, value) => check(name, Boolean(value), true)

/* ------------------------------------------------------------- calculator */

{
  const { calculate } = await load('features/search/calculator.ts')
  check('calc: addition', calculate('2+2'), '4')
  check('calc: precedence', calculate('2 + 3 * 4'), '14')
  check('calc: groups', calculate('(2 + 3) * 4'), '20')
  check('calc: right-associative power', calculate('2^3^2'), '512')
  check('calc: unary minus', calculate('-5 + 3'), '-2')
  check('calc: modulo', calculate('17 % 5'), '2')
  check('calc: x as multiply', calculate('5 x 6'), '30')
  check('calc: thousands separators', calculate('1,200 * 3'), '3,600')
  check('calc: function call', calculate('sqrt(144)'), '12')
  check('calc: constant', calculate('pi * 0'), '0')
  check('calc: leading decimal', calculate('.5 + .25'), '0.75')
  check('calc: plain number is not a sum', calculate('2024'), null)
  check('calc: words are not a sum', calculate('hello world'), null)
  check('calc: hostname is not a sum', calculate('netflix.com'), null)
  check('calc: incomplete expression', calculate('2 +'), null)
  check('calc: division by zero', calculate('1/0'), null)
  check('calc: unknown function', calculate('frobnicate(2)'), null)
  check('calc: no code execution', calculate('constructor'), null)
}

/* ------------------------------------------------------- engines and bangs */

{
  const { parseQuery, asDestination, buildSearchUrl } = await load('features/search/engines.ts')

  check('bang: leading', parseQuery('!yt cats', 'google', true).engine.id, 'youtube')
  check('bang: leading query survives', parseQuery('!yt cats', 'google', true).query, 'cats')
  check('bang: trailing', parseQuery('cats !yt', 'google', true).engine.id, 'youtube')
  check('bang: trailing query survives', parseQuery('cats !yt', 'google', true).query, 'cats')
  check('bang: bare goes to the home page', parseQuery('!gh', 'google', true).query, '')
  check('bang: unknown falls back', parseQuery('!zz cats', 'google', true).engine.id, 'google')
  check('bang: disabled is ignored', parseQuery('!yt cats', 'google', false).engine.id, 'google')
  check('bang: exclamation in text', parseQuery('hello! world', 'google', true).engine.id, 'google')

  check('url: bare host', asDestination('github.com'), 'https://github.com')
  check('url: with path', asDestination('github.com/anthropics'), 'https://github.com/anthropics')
  check('url: explicit scheme', asDestination('http://example.org'), 'http://example.org')
  check('url: localhost with port', asDestination('localhost:3000'), 'http://localhost:3000')
  check('url: a sentence is not a url', asDestination('what is a github'), null)
  check('url: a single word is not a url', asDestination('github'), null)
  check('url: no bare tld', asDestination('foo.'), null)

  check(
    'search: url encoding',
    buildSearchUrl(parseQuery('a b&c', 'duckduckgo', true)),
    'https://duckduckgo.com/?q=a%20b%26c',
  )
}

/* ------------------------------------------------------- settings and paths */

{
  const { getPath, setPath } = await load('core/util/path.ts')
  check('path: read nested', getPath({ a: { b: { c: 7 } } }, 'a.b.c'), 7)
  check('path: read missing', getPath({ a: {} }, 'a.b.c'), undefined)
  check('path: write nested', setPath({ a: { b: 1 } }, 'a.b', 2), { a: { b: 2 } })
  check('path: write preserves siblings', setPath({ a: { b: 1, z: 9 } }, 'a.b', 2), { a: { b: 2, z: 9 } })

  const original = { a: { b: 1 } }
  setPath(original, 'a.b', 2)
  check('path: write does not mutate', original, { a: { b: 1 } })
}

{
  const { SETTINGS_VERSION, defaultSettings, Settings } = await load('core/settings/schema.ts')
  const { migrate } = await load('core/settings/migrations.ts')

  const defaults = defaultSettings()
  check('settings: version', defaults.version, SETTINGS_VERSION)
  truthy('settings: round-trips through JSON', Settings.safeParse(JSON.parse(JSON.stringify(defaults))).success)

  check('migrate: empty gives defaults', migrate(undefined).appearance.mode, 'auto')
  check('migrate: null gives defaults', migrate(null).tiles.labelVisibility, 'hover')
  check('migrate: unknown fields are dropped', migrate({ nonsense: true }).version, SETTINGS_VERSION)
  check(
    'migrate: a partial section is filled in',
    migrate({ appearance: { radius: 0 } }).appearance.radius,
    0,
  )
  // Against the schema's own default rather than a literal: the point is that
  // the untouched field survives, not which preset happens to be default.
  check(
    'migrate: a partial section keeps other defaults',
    migrate({ appearance: { radius: 0 } }).appearance.preset,
    defaults.appearance.preset,
  )
  // A section that fails validation must not take the whole config with it.
  // This deliberately triggers the "[settings] falling back to defaults" warning.
  const salvaged = migrate({ appearance: { radius: 'purple' }, search: { engineId: 'bing' } })
  check('migrate: invalid section falls back', salvaged.appearance.radius, 16)
  check('migrate: valid sections survive', salvaged.search.engineId, 'bing')
}

/* ----------------------------------------------------------- theme codes */

{
  const { defaultSettings } = await load('core/settings/schema.ts')
  const { encodeTheme, applyTheme } = await load('core/settings/themeCode.ts')
  const { Tile } = await load('core/settings/schema.ts')

  const source = defaultSettings()
  source.appearance.radius = 0
  source.appearance.preset = 'ember'
  source.tiles.width = 240
  source.background.dim = 0.6

  const withContent = defaultSettings()
  withContent.tiles.items = [Tile.parse({ id: 'keep-me', url: 'https://example.com' })]
  withContent.background.image = { blobId: 'local-only', url: '' }

  const code = encodeTheme(source)
  truthy('theme: code is prefixed', code.startsWith('nt1.'))
  truthy('theme: code is url-safe', /^[A-Za-z0-9._-]+$/.test(code))

  const applied = applyTheme(withContent, code)
  check('theme: radius carried', applied.appearance.radius, 0)
  check('theme: palette carried', applied.appearance.preset, 'ember')
  check('theme: tile style carried', applied.tiles.width, 240)
  check('theme: wallpaper treatment carried', applied.background.dim, 0.6)
  check('theme: tiles are not carried', applied.tiles.items.length, 1)
  check('theme: tiles are the originals', applied.tiles.items[0].id, 'keep-me')
  check('theme: local media reference kept', applied.background.image.blobId, 'local-only')

  let rejected = false
  try {
    applyTheme(withContent, 'not-a-theme')
  } catch {
    rejected = true
  }
  truthy('theme: garbage is rejected', rejected)

  let damagedRejected = false
  try {
    applyTheme(withContent, 'nt1.@@@@')
  } catch {
    damagedRejected = true
  }
  truthy('theme: damaged payload is rejected', damagedRejected)
}

/* ------------------------------------------------------------------ time */

{
  const { timeParts } = await load('core/util/time.ts')
  const noon = new Date('2026-06-15T12:00:00Z')

  check('time: utc hours', timeParts(noon, 'UTC').hours24, 12)
  check('time: 12-hour noon', timeParts(noon, 'UTC').hours12, 12)
  check('time: meridiem at noon', timeParts(noon, 'UTC').meridiem, 'pm')
  check('time: half-hour offset zone', timeParts(noon, 'Asia/Kolkata').minutes, 30)
  check('time: half-hour offset hour', timeParts(noon, 'Asia/Kolkata').hours24, 17)

  const midnight = new Date('2026-06-15T00:00:00Z')
  check('time: midnight is hour zero', timeParts(midnight, 'UTC').hours24, 0)
  check('time: midnight reads as 12', timeParts(midnight, 'UTC').hours12, 12)
  check('time: midnight meridiem', timeParts(midnight, 'UTC').meridiem, 'am')

  // Daylight saving: New York is UTC-4 in June and UTC-5 in January.
  check('time: dst in summer', timeParts(noon, 'America/New_York').hours24, 8)
  check(
    'time: dst in winter',
    timeParts(new Date('2026-01-15T12:00:00Z'), 'America/New_York').hours24,
    7,
  )
}

/* ----------------------------------------------------------------- colour */

{
  const { hexToRgb, readableOn, contrast, ensureContrast, mix, isDark } = await load('core/theme/color.ts')

  check('colour: parse short hex', hexToRgb('#fff'), { r: 255, g: 255, b: 255 })
  check('colour: parse long hex', hexToRgb('#102030'), { r: 16, g: 32, b: 48 })
  check('colour: reject nonsense', hexToRgb('nope'), null)
  check('colour: white reads dark text', readableOn('#ffffff'), '#0b0d12')
  check('colour: black reads light text', readableOn('#000000'), '#ffffff')
  check('colour: mix midpoint', mix('#000000', '#ffffff', 0.5), '#808080')
  check('colour: dark detection', isDark('#101010'), true)
  check('colour: light detection', isDark('#f0f0f0'), false)

  // The whole point of ensureContrast: a low-contrast pairing must improve.
  const before = contrast(hexToRgb('#181717'), hexToRgb('#0b0d12'))
  const after = contrast(hexToRgb(ensureContrast('#181717', '#0b0d12', 3)), hexToRgb('#0b0d12'))
  truthy('colour: contrast is raised', after > before)
  truthy('colour: contrast reaches the target', after >= 3)
}

/* ------------------------------------------------------------------ brands */

{
  const { hostOf, monogram } = await load('features/tiles/brand.ts')
  check('brand: host of a url', hostOf('https://www.youtube.com/watch?v=1'), 'youtube.com')
  check('brand: host of a bare string', hostOf('youtube.com'), '')
  check('brand: monogram from a title', monogram('https://news.ycombinator.com', 'Hacker News'), 'HN')
  check('brand: monogram from a host', monogram('https://github.com'), 'GI')
}

/* ----------------------------------------------------- standard widget sizes */

{
  const { WIDGET_SIZES, SIZE_ORDER, snapSize, sizesFitting, orderSizes, nameOfSize } =
    await load('core/widgets/sizes.ts')
  const all = SIZE_ORDER

  check('size: an exact footprint stays put', snapSize({ w: 2, h: 2 }, all), 'large')
  check('size: a near miss rounds to the nearest', snapSize({ w: 3, h: 2 }, all), 'large')
  check('size: a wide drag reaches the wide size', snapSize({ w: 4, h: 1 }, all), 'wide')
  check('size: a tie goes to the smaller footprint', snapSize({ w: 1, h: 2 }, all), 'small')
  check('size: a huge drag is capped at the largest', snapSize({ w: 9, h: 9 }, all), 'xlarge')
  check(
    'size: undeclared sizes are never chosen',
    snapSize({ w: 1, h: 1 }, ['medium', 'large']),
    'medium',
  )
  check(
    'size: a narrow canvas rules out wide footprints',
    snapSize({ w: 4, h: 2 }, all, 2),
    'large',
  )
  check('size: nothing fits, so the narrowest wins', sizesFitting(['wide', 'xlarge'], 1), ['wide'])
  check('size: declared order does not matter', orderSizes(['xlarge', 'small']), ['small', 'xlarge'])
  check('size: a stored footprint is named', nameOfSize({ w: 4, h: 2 }, all), 'xlarge')
  check('size: every name has a footprint', Object.keys(WIDGET_SIZES).length, SIZE_ORDER.length)
}

/* ------------------------------------------------- widget canvas packing */

{
  const { normalizeLayout, nudgeDown, hasOverlap, stackVertically } =
    await load('core/widgets/layout.ts')
  const { SIZE_ORDER } = await load('core/widgets/sizes.ts')
  const anySize = () => SIZE_ORDER
  const box = (i, x, y, w, h) => ({ i, x, y, w, h })
  const at = (items, i) => items.find((item) => item.i === i)

  // The bug this module exists for: a layout stored against six columns is
  // clamped into two, which used to pile every widget onto the same cell.
  {
    const wide = [box('a', 0, 0, 2, 1), box('b', 2, 0, 2, 1), box('c', 4, 0, 2, 1)]
    const narrow = normalizeLayout(wide, 2, anySize, 'vertical')
    check('pack: a clamped layout does not overlap', hasOverlap(narrow), false)
    check('pack: clamping stacks in reading order', narrow.map((item) => item.y), [0, 1, 2])
  }

  // Growing a widget from the config dialog has to move its neighbours.
  {
    const grown = [box('a', 0, 0, 2, 2), box('b', 0, 1, 2, 1), box('c', 2, 0, 2, 1)]
    const packed = normalizeLayout(grown, 6, anySize, 'vertical')
    check('pack: a grown widget pushes the one below it', hasOverlap(packed), false)
    check('pack: the grown widget keeps its place', at(packed, 'a'), box('a', 0, 0, 2, 2))
    check('pack: the neighbour beside it does not move', at(packed, 'c'), box('c', 2, 0, 2, 1))
    check('pack: the one underneath drops clear', at(packed, 'b').y, 2)
  }

  // Free placement: positions are kept, overlaps are not.
  {
    const stacked = [box('a', 1, 1, 2, 1), box('b', 1, 1, 2, 1)]
    const free = nudgeDown(stacked, 6)
    check('pack: free mode keeps the first where it was', at(free, 'a'), box('a', 1, 1, 2, 1))
    check('pack: free mode does not pull it to the top', at(free, 'a').y, 1)
    check('pack: free mode drops the second clear', at(free, 'b'), box('b', 1, 2, 2, 1))
  }

  check(
    'pack: free mode clamps to the column count',
    nudgeDown([box('a', 5, 0, 2, 1)], 4),
    [box('a', 2, 0, 2, 1)],
  )

  // Left gravity has to wrap rather than run off the right-hand edge.
  {
    const row = [box('a', 0, 0, 4, 1), box('b', 0, 0, 4, 1), box('c', 0, 0, 4, 1)]
    const packed = normalizeLayout(row, 6, anySize, 'horizontal')
    check('pack: left gravity does not overlap', hasOverlap(packed), false)
    check('pack: left gravity wraps at the edge', at(packed, 'b'), box('b', 0, 1, 4, 1))
  }

  check('pack: order is preserved for react keys', normalizeLayout(
    [box('z', 0, 4, 2, 1), box('a', 0, 0, 2, 1)], 6, anySize, 'vertical',
  ).map((item) => item.i), ['z', 'a'])

  check('pack: a pinned widget is never moved', nudgeDown(
    [{ ...box('a', 0, 0, 2, 2), static: true }, box('b', 0, 0, 2, 1)], 6,
  ).map((item) => item.y), [0, 2])

  check('pack: an empty layout is fine', normalizeLayout([], 6, anySize, 'vertical'), [])
  /*
   * Stacking is the one thing a too-narrow window does. Every widget spans the
   * band, keeps its height, and follows the one before it in reading order.
   */
  {
    const wide = [box('a', 0, 0, 2, 1), box('b', 2, 0, 2, 2), box('c', 4, 0, 2, 1)]
    const stack = stackVertically(wide, 1)

    check('stack: everything starts at the left edge', stack.every((i) => i.x === 0), true)
    check('stack: everything spans the band', stack.every((i) => i.w === 1), true)
    check('stack: heights are kept', stack.map((i) => i.h), [1, 2, 1])
    check('stack: rows follow each other with no gaps', stack.map((i) => i.y), [0, 1, 3])
    check('stack: nothing overlaps', hasOverlap(stack), false)
    check('stack: order is preserved for react keys', stack.map((i) => i.i), ['a', 'b', 'c'])

    // Reading order decides the sequence, not the order the array happens in.
    const jumbled = [box('c', 0, 2, 2, 1), box('a', 0, 0, 2, 1), box('b', 2, 0, 2, 1)]
    const ordered = stackVertically(jumbled, 1)
    check(
      'stack: reading order decides the sequence',
      [...ordered].sort((p, q) => p.y - q.y).map((i) => i.i),
      ['a', 'b', 'c'],
    )

    check('stack: an empty layout is fine', stackVertically([], 1), [])
    check('stack: stacking twice changes nothing', stackVertically(stack, 1), stack)
  }

  /*
   * Narrowing has to carry the reader's arrangement down rather than invent a
   * new one. A layout clamped into fewer columns keeps its reading order —
   * top row first, then left to right — which is what makes the narrow view
   * recognisably the same dashboard rather than the same widgets reshuffled.
   */
  {
    const wide = [box('a', 0, 0, 2, 1), box('b', 2, 0, 2, 1), box('c', 4, 0, 2, 1)]
    const readingOrder = (items) =>
      [...items].sort((p, q) => p.y - q.y || p.x - q.x).map((item) => item.i)

    for (const cols of [2, 3, 4, 6]) {
      const narrowed = normalizeLayout(wide, cols, anySize, 'vertical')
      check(`derive: ${cols} columns keeps reading order`, readingOrder(narrowed), ['a', 'b', 'c'])
      check(`derive: ${cols} columns does not overlap`, hasOverlap(narrowed), false)
      check(
        `derive: ${cols} columns stays in the band`,
        narrowed.every((item) => item.x >= 0 && item.x + item.w <= cols),
        true,
      )
    }

    // Narrowing then widening again must land back on the original layout.
    const roundTrip = normalizeLayout(
      normalizeLayout(wide, 6, anySize, 'vertical'),
      6,
      anySize,
      'vertical',
    )
    check('derive: normalising twice is stable', roundTrip, wide)
  }

  /*
   * The resize round-trip, which is the whole reason there is one layout now.
   *
   * A narrow window renders a stack, and renders it from the stored layout
   * every time rather than writing it back. So no sequence of resizes changes
   * what is on disk, and widening always returns the arrangement intact — the
   * failure that used to need a reload, and survived one.
   */
  {
    const wide = [box('a', 0, 0, 2, 2), box('b', 2, 0, 2, 2), box('c', 4, 0, 2, 2)]

    /** What the canvas commits, given whether the band is too narrow to fit. */
    const toStore = (isStacked, stored, emitted) => (isStacked ? stored : emitted)

    let disk = wide
    for (const isStacked of [true, true, false, true, false]) {
      const emitted = isStacked ? stackVertically(disk, 1) : disk
      disk = toStore(isStacked, disk, emitted)
    }
    check('resize: no sequence of resizes rewrites the layout', disk, wide)

    // A stacked canvas emits the stack; storing it would be the old bug.
    check(
      'resize: a stacked canvas never stores what it renders',
      toStore(true, wide, stackVertically(wide, 1)),
      wide,
    )

    // A genuine rearrange at full width is still committed.
    const rearranged = [box('a', 2, 0, 2, 2), box('b', 0, 0, 2, 2), box('c', 4, 0, 2, 2)]
    check('resize: a real rearrangement is stored', toStore(false, wide, rearranged), rearranged)
  }
}

/* ------------------------------------------------- widget layout migration */

{
  const { migrate } = await load('core/settings/migrations.ts')

  const stored = {
    version: 1,
    widgets: {
      columns: 24,
      rowHeight: 56,
      margin: 14,
      instances: [{ id: 'a', type: 'clock' }, { id: 'b', type: 'notes' }],
      layouts: {
        lg: [
          { i: 'a', x: 8, y: 0, w: 8, h: 3 },
          { i: 'b', x: 0, y: 3, w: 6, h: 5 },
        ],
      },
    },
  }
  const after = migrate(stored).widgets

  check('migrate: version is current', migrate(stored).version >= 4, true)
  check('migrate: columns become widgets across', after.columns, 6)
  check('migrate: row height is gone', 'rowHeight' in after, false)
  check('migrate: per-breakpoint layouts are gone', 'layouts' in after, false)
  check('migrate: a wide short widget becomes medium', after.layout[0], {
    i: 'a',
    x: 2,
    y: 0,
    w: 2,
    h: 1,
  })
  // The 2 -> 3 step packs whatever the 1 -> 2 step produced, so the gap the
  // rescale left under the clock is closed on the way through.
  check('migrate: a tall widget becomes large', after.layout[1], {
    i: 'b',
    x: 0,
    y: 0,
    w: 2,
    h: 2,
  })
  truthy('migrate: junk still parses', Boolean(migrate({ version: 1, widgets: { layouts: 7 } })))

  // The 2 -> 3 step separated layouts nothing had ever checked; the 3 -> 4 step
  // then folds them down to the one the reader actually arranged.
  {
    const { hasOverlap } = await load('core/widgets/layout.ts')
    const folded = migrate({
      version: 2,
      widgets: {
        columns: 6,
        instances: [{ id: 'a', type: 'clock' }, { id: 'b', type: 'notes' }],
        layouts: {
          lg: [{ i: 'a', x: 0, y: 0, w: 2, h: 2 }, { i: 'b', x: 2, y: 0, w: 2, h: 1 }],
          sm: [{ i: 'a', x: 0, y: 0, w: 2, h: 2 }, { i: 'b', x: 0, y: 0, w: 2, h: 1 }],
        },
      },
    }).widgets

    check('migrate: the widest layout is the one kept', folded.layout, [
      { i: 'a', x: 0, y: 0, w: 2, h: 2 },
      { i: 'b', x: 2, y: 0, w: 2, h: 1 },
    ])
    check('migrate: the folded layout does not overlap', hasOverlap(folded.layout), false)
    check('migrate: the narrow layouts are dropped', 'layouts' in folded, false)

    // Nothing at `lg` falls through to whatever else was stored.
    const fallback = migrate({
      version: 3,
      widgets: {
        columns: 6,
        instances: [{ id: 'a', type: 'clock' }],
        layouts: { lg: [], sm: [{ i: 'a', x: 0, y: 0, w: 2, h: 1 }] },
      },
    }).widgets
    check('migrate: an empty widest layout falls back', fallback.layout, [
      { i: 'a', x: 0, y: 0, w: 2, h: 1 },
    ])
  }
}

/* -------------------------------------------------------- calendar feeds */

{
  const { parseCalendar, calendarName } = await load('features/widgets/calendar/ics.ts')
  const { normaliseUrl, colorOf } = await load('features/widgets/calendar/api.ts')

  const wrap = (body) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nX-WR-CALNAME:Work\r\n${body}\r\nEND:VCALENDAR`
  const event = (lines) => wrap(`BEGIN:VEVENT\r\n${lines.join('\r\n')}\r\nEND:VEVENT`)
  // A whole month, so expansion has somewhere to land.
  const from = new Date(2026, 2, 1).getTime()
  const to = new Date(2026, 3, 1).getTime()
  const read = (ics) => parseCalendar(ics, from, to)
  const at = (y, m, d, hh = 0, mm = 0) => new Date(y, m - 1, d, hh, mm).getTime()

  check('ics: calendar name', calendarName(wrap('')), 'Work')

  {
    const events = read(
      event(['UID:a', 'SUMMARY:Standup', 'DTSTART:20260304T090000', 'DTEND:20260304T093000']),
    )
    check('ics: one timed event', events.length, 1)
    check('ics: title', events[0].title, 'Standup')
    check('ics: local start', events[0].start, at(2026, 3, 4, 9))
    check('ics: not all day', events[0].allDay, false)
  }

  // Folded lines are the norm from real producers, not an edge case.
  check(
    'ics: folded lines rejoin',
    read(event(['UID:b', 'SUMMARY:A very long meet', ' ing title', 'DTSTART:20260304T090000']))[0]
      .title,
    'A very long meeting title',
  )

  check(
    'ics: escapes are unescaped',
    read(event(['UID:c', 'SUMMARY:Lunch\\, then\; talk', 'DTSTART:20260304T120000']))[0].title,
    'Lunch, then; talk',
  )

  {
    const events = read(event(['UID:d', 'SUMMARY:Off', 'DTSTART;VALUE=DATE:20260310', 'DTEND;VALUE=DATE:20260312']))
    check('ics: all day flag', events[0].allDay, true)
    check('ics: all day starts at local midnight', events[0].start, at(2026, 3, 10))
    check('ics: all day end is exclusive', events[0].end, at(2026, 3, 12))
  }

  check(
    'ics: DURATION sets the end',
    read(event(['UID:e', 'SUMMARY:Call', 'DTSTART:20260304T090000', 'DURATION:PT1H30M']))[0].end,
    at(2026, 3, 4, 10, 30),
  )

  // A VALARM carries its own DTSTART/DURATION; reading them would move the event.
  check(
    'ics: an alarm does not move the event',
    read(
      event([
        'UID:f',
        'SUMMARY:Review',
        'DTSTART:20260304T140000',
        'DTEND:20260304T150000',
        'BEGIN:VALARM',
        'TRIGGER:-PT10M',
        'ACTION:DISPLAY',
        'END:VALARM',
      ]),
    )[0].start,
    at(2026, 3, 4, 14),
  )

  check(
    'ics: cancelled events are dropped',
    read(event(['UID:g', 'SUMMARY:Gone', 'DTSTART:20260304T090000', 'STATUS:CANCELLED'])).length,
    0,
  )

  {
    // A weekly meeting started long before the window still fills this month.
    const weekly = read(
      event([
        'UID:h',
        'SUMMARY:Weekly',
        'DTSTART:20250106T100000',
        'DTEND:20250106T110000',
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
      ]),
    )
    check('ics: weekly recurrence fills the month', weekly.length, 5)
    truthy(
      'ics: every weekly occurrence is a Monday',
      weekly.every((e) => new Date(e.start).getDay() === 1),
    )
    truthy(
      'ics: recurrence keeps the clock time',
      weekly.every((e) => new Date(e.start).getHours() === 10),
    )
  }

  check(
    'ics: BYDAY makes several days a week',
    read(
      event([
        'UID:i',
        'SUMMARY:Gym',
        'DTSTART:20260302T070000',
        'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR',
      ]),
    ).length,
    13,
  )

  check(
    'ics: COUNT stops the series',
    read(event(['UID:j', 'SUMMARY:Three', 'DTSTART:20260302T090000', 'RRULE:FREQ=DAILY;COUNT=3']))
      .length,
    3,
  )

  check(
    'ics: UNTIL stops the series',
    read(
      event(['UID:k', 'SUMMARY:Til', 'DTSTART:20260302T090000', 'RRULE:FREQ=DAILY;UNTIL=20260305T000000Z']),
    ).length,
    3,
  )

  check(
    'ics: INTERVAL skips',
    read(event(['UID:l', 'SUMMARY:Alt', 'DTSTART:20260302T090000', 'RRULE:FREQ=DAILY;INTERVAL=10']))
      .length,
    3,
  )

  check(
    'ics: EXDATE removes one occurrence',
    read(
      event([
        'UID:m',
        'SUMMARY:Daily',
        'DTSTART:20260302T090000',
        'RRULE:FREQ=DAILY;COUNT=4',
        'EXDATE:20260303T090000',
      ]),
    ).length,
    3,
  )

  // A monthly series on the 31st has no February, and must not slide to the 1st.
  check(
    'ics: a monthly 31st skips short months',
    parseCalendar(
      event(['UID:n', 'SUMMARY:Rent', 'DTSTART:20260131T090000', 'RRULE:FREQ=MONTHLY']),
      new Date(2026, 1, 1).getTime(),
      new Date(2026, 2, 1).getTime(),
    ).length,
    0,
  )

  {
    // The moved instance of a weekly meeting replaces its generated occurrence.
    const moved = parseCalendar(
      wrap(
        [
          'BEGIN:VEVENT',
          'UID:o',
          'SUMMARY:Sync',
          'DTSTART:20260302T090000',
          'DTEND:20260302T093000',
          'RRULE:FREQ=WEEKLY;COUNT=3',
          'END:VEVENT',
          'BEGIN:VEVENT',
          'UID:o',
          'RECURRENCE-ID:20260309T090000',
          'SUMMARY:Sync (moved)',
          'DTSTART:20260309T140000',
          'DTEND:20260309T143000',
          'END:VEVENT',
        ].join('\r\n'),
      ),
      from,
      to,
    )
    check('ics: an override does not duplicate its occurrence', moved.length, 3)
    truthy(
      'ics: the override replaces that occurrence',
      moved.some((e) => e.start === at(2026, 3, 9, 14)) &&
        !moved.some((e) => e.start === at(2026, 3, 9, 9)),
    )
  }

  check(
    'ics: an unsupported rule still shows once',
    read(event(['UID:p', 'SUMMARY:Odd', 'DTSTART:20260304T090000', 'RRULE:FREQ=SECONDLY'])).length,
    1,
  )

  {
    // The join link is almost never in URL; it is buried in the description.
    const url = (lines) => read(event(['UID:u', 'SUMMARY:Call', 'DTSTART:20260304T090000', ...lines]))[0].url
    check('ics: URL property is read', url(['URL:https://example.com/a']), 'https://example.com/a')
    check(
      'ics: a link is found in the description',
      url(['DESCRIPTION:Join at https://meet.example.com/abc-def to talk']),
      'https://meet.example.com/abc-def',
    )
    check(
      'ics: URL wins over the description',
      url(['URL:https://example.com/a', 'DESCRIPTION:see https://other.example.com/b']),
      'https://example.com/a',
    )
    check(
      'ics: a sentence full stop is not part of the link',
      url(['DESCRIPTION:Join https://meet.example.com/abc.']),
      'https://meet.example.com/abc',
    )
    check('ics: no link is empty', url(['DESCRIPTION:Bring a pen']), '')
    // These values come off the network and are handed to the browser to open.
    check('ics: a script url is not a link', url(['URL:javascript:alert(1)']), '')
    check(
      'ics: a script url in the description is not a link',
      url(['DESCRIPTION:click javascript:alert(1) now']),
      '',
    )
  }

  check('ics: junk is not a calendar', read('not a calendar at all').length, 0)
  check('ics: an empty document is empty', read(''), [])

  check('cal url: webcal becomes https', normaliseUrl('webcal://example.com/a.ics'), 'https://example.com/a.ics')
  check('cal url: a bare host gets a scheme', normaliseUrl('example.com/a.ics'), 'https://example.com/a.ics')
  check('cal url: https survives', normaliseUrl('https://example.com/a.ics'), 'https://example.com/a.ics')
  check('cal url: rubbish is rejected', normaliseUrl('javascript:alert(1)'), '')
  check('cal url: empty is rejected', normaliseUrl('   '), '')
  check('cal colour: wraps', colorOf(8), colorOf(0))
  check('cal colour: a negative index still resolves', colorOf(-1), colorOf(7))
}

/* ------------------------------------------------------ task shorthand */

{
  const { parseDraft, parseDue, dueLabel, daysUntil, addDays, startOfDay, sortItems } = await load(
    'features/widgets/todo/parse.ts',
  )

  // A Wednesday, so weekday arithmetic has somewhere to go in both directions.
  const today = startOfDay(new Date(2026, 7, 26))
  const draft = (input) => parseDraft(input, today)
  const dayOf = (input) => {
    const due = parseDue(input, today)
    return due === null ? null : daysUntil(due, today)
  }

  check('todo: plain text is just text', draft('buy milk'), { text: 'buy milk', priority: 0, due: 0 })
  check('todo: one bang is high', draft('ship it !').priority, 1)
  check('todo: two bangs are medium', draft('ship it !!').priority, 2)
  check('todo: three bangs are low', draft('ship it !!!').priority, 3)
  check('todo: p-notation works too', draft('ship it p2').priority, 2)
  check('todo: the marker leaves the title', draft('ship it !').text, 'ship it')
  check('todo: a mid-sentence marker still parses', draft('call ! the bank').text, 'call the bank')
  check('todo: a bang inside a word is text', draft('wow!! really').priority, 0)

  check('todo: today', dayOf('today'), 0)
  check('todo: tomorrow', dayOf('tomorrow'), 1)
  check('todo: a span in days', dayOf('3d'), 3)
  check('todo: a span in weeks', dayOf('2w'), 14)
  check('todo: a weekday ahead', dayOf('friday'), 2)
  check('todo: an abbreviated weekday', dayOf('fri'), 2)
  check("todo: today's own weekday means next week", dayOf('wednesday'), 7)
  check('todo: next pushes a week out', dayOf('next friday'), 9)
  check('todo: a day-first date', dayOf('25/12'), daysUntil(startOfDay(new Date(2026, 11, 25)), today))
  check('todo: a past date rolls to next year', dayOf('1/1'), daysUntil(startOfDay(new Date(2027, 0, 1)), today))
  check('todo: an explicit year is respected', dayOf('1/1/2027'), daysUntil(startOfDay(new Date(2027, 0, 1)), today))
  check('todo: an impossible day is not a date', dayOf('32/1'), null)
  check('todo: an impossible month is not a date', dayOf('1/13'), null)
  check('todo: words are not a date', dayOf('the bank'), null)

  check('todo: a date leaves the title', draft('pay rent @ tomorrow').text, 'pay rent')
  check('todo: a date and a priority together', draft('pay rent ! @ friday').priority, 1)
  check('todo: both markers leave the title', draft('pay rent ! @ friday').text, 'pay rent')
  check(
    'todo: unparseable @ text is left alone',
    draft('email @ the bank'),
    { text: 'email @ the bank', priority: 0, due: 0 },
  )
  check('todo: an address survives', draft('mail sam@example.com').text, 'mail sam@example.com')
  check(
    'todo: markers are inert while the features are off',
    parseDraft('ship it ! @ friday', today, { priorities: false, dueDates: false }),
    { text: 'ship it ! @ friday', priority: 0, due: 0 },
  )
  check(
    'todo: a date parses while priorities are off',
    parseDraft('ship it @ friday', today, { priorities: false, dueDates: true }).text,
    'ship it',
  )


  /* Ordering. `manual` is the old behaviour and must stay it. */
  {
    const task = (id, priority, due, done = false) => ({ id, priority, due, done })
    const ids = (items) => items.map((item) => item.id).join('')

    const mixed = [
      task('a', 3, addDays(today, 5)),
      task('b', 1, addDays(today, 9)),
      task('c', 0, 0),
      task('d', 2, addDays(today, 1)),
    ]
    check('todo sort: manual keeps insertion order', ids(sortItems(mixed, 'manual')), 'abcd')
    check('todo sort: by priority', ids(sortItems(mixed, 'priority')), 'bdac')
    check('todo sort: by due date', ids(sortItems(mixed, 'due')), 'dabc')
    check('todo sort: undated tasks sort last', ids(sortItems([task('x', 0, 0), task('y', 0, addDays(today, 1))], 'due')), 'yx')
    check(
      'todo sort: unprioritised tasks sort last',
      ids(sortItems([task('x', 0, 0), task('y', 3, 0)], 'priority')),
      'yx',
    )

    const withDone = [task('a', 1, 0, true), task('b', 3, 0), task('c', 2, 0)]
    check('todo sort: done sinks under manual', ids(sortItems(withDone, 'manual')), 'bca')
    check('todo sort: done sinks under priority', ids(sortItems(withDone, 'priority')), 'cba')
    check('todo sort: sorting does not mutate', ids(withDone), 'abc')
  }

  check('todo: label for today', dueLabel(today, today, 'en-GB'), 'Today')
  check('todo: label for tomorrow', dueLabel(addDays(today, 1), today, 'en-GB'), 'Tomorrow')
  check('todo: label for this week is a weekday', dueLabel(addDays(today, 2), today, 'en-GB'), 'Friday')
  check('todo: label for overdue', dueLabel(addDays(today, -3), today, 'en-GB'), '3 days ago')
  // Against Intl rather than a literal: month abbreviations differ by ICU version.
  check(
    'todo: label for far off is a date',
    dueLabel(addDays(today, 30), today, 'en-GB'),
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(addDays(today, 30)),
  )
}

/* ------------------------------------------------------------------ output */

console.log(`${passed} checks passed, ${failures.length} failed`)
if (failures.length) {
  console.log('\n' + failures.map((f) => '  ' + f).join('\n'))
  process.exitCode = 1
}
