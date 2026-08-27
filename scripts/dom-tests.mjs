/**
 * Checks logic that needs a real DOM.
 *
 * `npm test` runs under plain Node, which has no `DOMParser`, so the feed parser
 * cannot be covered there. Rather than shipping a DOM shim, these run in the dev
 * server's page and import the source module directly — Vite transforms it on
 * the fly, so this tests the real code with nothing extra in the bundle.
 *
 *   npm run dev            # in another terminal
 *   node scripts/dom-tests.mjs [baseUrl]
 */
import { chromium } from 'playwright'

const base = process.argv[2] ?? 'http://localhost:5178'

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Example Blog</title>
  <item>
    <title>Second post</title>
    <link>https://example.com/2</link>
    <guid>tag:example,2</guid>
    <pubDate>Tue, 26 Aug 2026 10:00:00 GMT</pubDate>
    <description>&lt;p&gt;Some &lt;b&gt;HTML&lt;/b&gt; body &amp;amp; entities.&lt;/p&gt;</description>
  </item>
  <item>
    <title>First post</title>
    <link>https://example.com/1</link>
    <pubDate>Mon, 25 Aug 2026 10:00:00 GMT</pubDate>
  </item>
</channel></rss>`

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Journal</title>
  <entry>
    <title>Atom entry</title>
    <id>urn:uuid:1</id>
    <link rel="edit" href="https://example.org/edit/1"/>
    <link rel="alternate" href="https://example.org/read/1"/>
    <updated>2026-08-27T12:00:00Z</updated>
    <summary>An atom summary.</summary>
  </entry>
</feed>`

const browser = await chromium.launch()
const page = await browser.newPage()
try {
  await page.goto(`${base}/newtab.html`)
} catch {
  console.error(`Could not reach ${base}. Start the dev server with \`npm run dev\`.`)
  await browser.close()
  process.exit(1)
}
await page.waitForTimeout(600)

const results = await page.evaluate(async ([rss, atom]) => {
  const { parseFeed } = await import('/src/features/widgets/feed/parse.ts')
  const checks = []
  const check = (name, actual, expected) =>
    checks.push({ name, ok: JSON.stringify(actual) === JSON.stringify(expected), actual, expected })

  const feed = parseFeed(rss)
  check('rss: channel title', feed?.title, 'Example Blog')
  check('rss: item count', feed?.items.length, 2)
  check('rss: guid preferred as id', feed?.items[0].id, 'tag:example,2')
  check('rss: link', feed?.items[0].link, 'https://example.com/2')
  check('rss: pubDate parsed', feed?.items[0].published, Date.parse('Tue, 26 Aug 2026 10:00:00 GMT'))
  check('rss: html stripped and entities decoded', feed?.items[0].summary, 'Some HTML body & entities.')
  check('rss: id falls back to the link', feed?.items[1].id, 'https://example.com/1')
  check('rss: missing description', feed?.items[1].summary, '')

  const atomFeed = parseFeed(atom)
  check('atom: feed title, not the entry title', atomFeed?.title, 'Atom Journal')
  check('atom: alternate link preferred', atomFeed?.items[0].link, 'https://example.org/read/1')
  check('atom: updated parsed', atomFeed?.items[0].published, Date.parse('2026-08-27T12:00:00Z'))
  check('atom: summary', atomFeed?.items[0].summary, 'An atom summary.')

  check('malformed xml is rejected', parseFeed('<<not xml'), null)
  check('valid xml that is not a feed is rejected', parseFeed('<?xml version="1.0"?><root><a/></root>'), null)
  check('empty input is rejected', parseFeed(''), null)

  return checks
}, [RSS, ATOM])

await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`${results.length - failed.length} checks passed, ${failed.length} failed`)
for (const failure of failed) {
  console.log(`  ${failure.name}\n    expected ${JSON.stringify(failure.expected)}\n    actual   ${JSON.stringify(failure.actual)}`)
}
if (failed.length) process.exitCode = 1
