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
  const { defaultSettings, Settings } = await load('core/settings/schema.ts')
  const { migrate } = await load('core/settings/migrations.ts')

  const defaults = defaultSettings()
  check('settings: version', defaults.version, 1)
  truthy('settings: round-trips through JSON', Settings.safeParse(JSON.parse(JSON.stringify(defaults))).success)

  check('migrate: empty gives defaults', migrate(undefined).appearance.mode, 'auto')
  check('migrate: null gives defaults', migrate(null).tiles.labelVisibility, 'hover')
  check('migrate: unknown fields are dropped', migrate({ nonsense: true }).version, 1)
  check(
    'migrate: a partial section is filled in',
    migrate({ appearance: { radius: 0 } }).appearance.radius,
    0,
  )
  check(
    'migrate: a partial section keeps other defaults',
    migrate({ appearance: { radius: 0 } }).appearance.preset,
    'midnight',
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

/* ------------------------------------------------------------------ output */

console.log(`${passed} checks passed, ${failures.length} failed`)
if (failures.length) {
  console.log('\n' + failures.map((f) => '  ' + f).join('\n'))
  process.exitCode = 1
}
