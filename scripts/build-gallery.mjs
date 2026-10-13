/**
 * Builds the slate gallery page from `slates/`.
 *
 * The gallery lives on the website rather than in the extension, so browsing it
 * costs the extension no network access at all. Each card carries a deep link
 * into the extension with the slate in the URL, which is a navigation rather
 * than a request: the site can hand over a layout without ever being allowed to
 * talk to the browser.
 *
 * Previews are drawn here from the payload rather than submitted as images. A
 * picture generated from the code cannot disagree with the code it claims to
 * show, and nobody has to trust a screenshot in a pull request.
 *
 *   node --import ./scripts/register.mjs scripts/build-gallery.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { footer, nav, pageHead } from './site-shell.mjs'

const { decodeSlate, previewUrl, slateThumbnail, STORE_ID } = await import('@/core/settings/slateCode')
const { GalleryIndex, creditOf } = await import('@/core/settings/slateGallery')

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(root, 'marketing/site/slates.html')
const INDEX = join(root, 'marketing/site/slates.json')

/** Text into HTML. Entry text is checked on the way in, and escaped again here. */
const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * The grid, as blocks. Not a screenshot of the real page: at card size a
 * faithful render is unreadable, and the thing worth seeing is the shape -
 * how many widgets, how big, and where they sit.
 */
function renderPreview(payload) {
  const { columns, rows, cells } = slateThumbnail(payload)
  const blocks = cells
    .map((cell) => {
      const style = `grid-column:${cell.column}/span ${cell.spanX};grid-row:${cell.row}/span ${cell.spanY}`
      return `<span class="cell" style="${style}"><i>${esc(cell.type)}</i></span>`
    })
    .join('')
  return `<div class="grid" style="grid-template-columns:repeat(${columns},1fr);grid-template-rows:repeat(${rows},1fr)" aria-hidden="true">${blocks}</div>`
}

function renderCard(entry) {
  const payload = decodeSlate(entry.code)
  const { label, username } = creditOf(entry)
  const count = payload.widgets.length
  const link = previewUrl(entry.code, entry.name, label, STORE_ID)

  return `<article class="slate">
  ${renderPreview(payload)}
  <div class="meta">
    <h2>${esc(entry.name)}</h2>
    <p class="what">${esc(entry.description)}</p>
    <p class="by">${count === 1 ? '1 widget' : `${count} widgets`} &middot; by <a href="https://github.com/${esc(username)}" rel="noopener noreferrer">${esc(label)}</a></p>
    <div class="actions">
      <a class="btn" href="${esc(link)}">Use this slate</a>
      <button class="btn ghost copy" type="button" data-code="${esc(entry.code)}">Copy slate</button>
    </div>
  </div>
</article>`
}

function renderPage(entries) {
  const cards = entries.map(renderCard).join('\n')
  const empty = `<p class="none">No slates have been shared yet. <a href="https://github.com/thepropotato/open-slate/issues/new?template=slate-submission.yml">Be the first</a>.</p>`

  return `${pageHead({
    title: 'Open Slate: community slates',
    description: 'Slates shared by people who use Open Slate. Apply one to your new tab in a click.',
    path: 'slates',
  })}
${nav}
<main>
<div class="wrap">
  <header class="doc-head">
    <a class="btn ghost sm back" href="/"><svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>Back to home</a>
    <h1>Community slates</h1>
    <p class="lede">A slate is an arrangement of your new tab: which widgets are on the grid,
    where they sit, and the shape of the page around them. These are the ones people have
    built and shared. Applying one leaves your tiles, notes and tasks exactly as they are.</p>
  </header>

${entries.length > 0 ? `<div class="slates">\n${cards}\n</div>` : empty}

  <section class="how">
    <h2>How this works</h2>
    <p>A slate carries the arrangement and nothing else: which widgets are on the grid,
    where they sit, and the shape of the page around them. It holds no calendars, no
    locations and no accounts, so whoever applies one points the widgets at their own.
    &ldquo;Use this slate&rdquo; opens the extension with it in the link and shows you
    the result before anything changes.</p>
    <p>To share yours, open Settings &rarr; Slates in the extension and press
    <strong>Share my slate</strong>.</p>
  </section>
</div>
</main>

${footer}
<script>
// The link works without this; the copy button is extra.
document.querySelectorAll('.copy').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.code)
      button.textContent = 'Copied'
      setTimeout(() => { button.textContent = 'Copy slate' }, 2000)
    } catch {
      button.textContent = 'Press Ctrl+C'
    }
  })
})
</script>
</body>
</html>
`
}

const index = GalleryIndex.parse(JSON.parse(readFileSync(INDEX, 'utf8')))
const rendered = renderPage(index.slates)

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(OUT, 'utf8')
  } catch {
    /* not written yet */
  }
  if (current !== rendered) {
    console.error('marketing/site/slates.html is out of date. Run `npm run slates`.')
    process.exit(1)
  }
  console.log('Gallery page is up to date.')
} else {
  writeFileSync(OUT, rendered)
  console.log(`Wrote ${OUT.slice(root.length + 1)} with ${index.slates.length} slate(s).`)
}
