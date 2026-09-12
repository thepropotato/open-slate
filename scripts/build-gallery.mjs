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

const { decodeSlate, previewUrl, STORE_ID } = await import('@/core/settings/slateCode')
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
  const columns = payload.columns || 6
  const rows = Math.max(...payload.widgets.map((w) => w.y + w.h), 1)
  const cells = payload.widgets
    .map((widget) => {
      const style = [
        `grid-column:${widget.x + 1}/span ${widget.w}`,
        `grid-row:${widget.y + 1}/span ${widget.h}`,
      ].join(';')
      return `<span class="cell" style="${style}"><i>${esc(widget.type)}</i></span>`
    })
    .join('')
  return `<div class="grid" style="grid-template-columns:repeat(${columns},1fr);grid-template-rows:repeat(${rows},1fr)" aria-hidden="true">${cells}</div>`
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
      <a class="use" href="${esc(link)}">Use this layout</a>
      <button class="copy" type="button" data-code="${esc(entry.code)}">Copy code</button>
    </div>
  </div>
</article>`
}

function renderPage(entries) {
  const privacy = readFileSync(join(root, 'marketing/site/privacy.html'), 'utf8')
  const style = privacy.slice(privacy.indexOf('<style>'), privacy.indexOf('</style>') + 8)

  const cards = entries.map(renderCard).join('\n')
  const empty = `<p class="none">No slates have been shared yet. <a href="https://github.com/thepropotato/open-slate/issues/new?template=slate-submission.yml">Be the first</a>.</p>`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Open Slate: layouts</title>
<meta name="description" content="Layouts shared by people who use Open Slate. Apply one to your new tab in a click.">
<link rel="canonical" href="https://openslate.byvenu.com/slates">
<meta name="robots" content="index, follow">

<meta property="og:type" content="website">
<meta property="og:url" content="https://openslate.byvenu.com/slates">
<meta property="og:title" content="Open Slate: layouts">
<meta property="og:description" content="Layouts shared by people who use Open Slate. Apply one to your new tab in a click.">
<meta property="og:image" content="https://openslate.byvenu.com/img/og.png">
<meta property="og:site_name" content="Open Slate">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

${style}
<style>
.wrap{max-width:64rem}
header h1{font:400 clamp(2rem,5vw,2.75rem)/1.1 var(--serif);letter-spacing:-.02em;color:var(--head);margin:1rem 0 .5rem}
.lede{max-width:62ch;color:var(--muted);margin:0 0 2.5rem}

.slates{display:grid;gap:1.5rem;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));padding:0;list-style:none}
.slate{border:1px solid var(--border);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;background:var(--surface)}

/* The preview: blocks on the slate's own grid, so the shape is the message. */
.grid{display:grid;gap:4px;padding:12px;aspect-ratio:16/10;background:rgba(127,127,127,.06);border-bottom:1px solid var(--border)}
.cell{border-radius:5px;background:rgba(127,127,127,.22);display:grid;place-items:center;overflow:hidden;min-width:0}
.cell i{font-style:normal;font-size:9px;letter-spacing:.02em;color:var(--muted);opacity:.85;padding:0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.meta{padding:1rem 1.1rem 1.15rem;display:flex;flex-direction:column;gap:.35rem;flex:1}
.meta h2{font:600 1.05rem/1.3 var(--sans,inherit);text-transform:none;letter-spacing:0;color:var(--head);margin:0;border:0;padding:0}
.what{margin:0;color:var(--muted);font-size:.925rem;line-height:1.5}
.by{margin:.15rem 0 0;font-size:.825rem;color:var(--muted)}
.actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-top:auto;padding-top:.85rem}
.use,.copy{font:500 .875rem/1 inherit;padding:.6rem .9rem;border-radius:8px;border:1px solid var(--border);background:none;color:inherit;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center}
/* Paired with --page, not a fixed white: the accent lightens in dark mode, so a
   hardcoded white label loses its contrast exactly where the ground is palest. */
.use{background:var(--accent);color:var(--page);border-color:var(--accent)}
.copy[data-done]{color:var(--muted)}
.none{color:var(--muted)}

.how{margin-top:3rem;border-top:1px solid var(--border);padding-top:1.5rem;color:var(--muted);max-width:62ch}
.how h2{font:600 1rem/1.3 inherit;text-transform:none;letter-spacing:0;color:var(--head);margin:0 0 .5rem;border:0;padding:0}
</style>
</head>
<body>

<div class="wrap">
  <header>
    <a class="back" href="/">&larr; Open Slate</a>
    <h1>Layouts</h1>
    <p class="lede">Arrangements people have shared. Applying one rearranges the widgets on your
    new tab and leaves your tiles, notes and tasks exactly as they are.</p>
  </header>

<main>
${entries.length > 0 ? `<div class="slates">\n${cards}\n</div>` : empty}

<section class="how">
<h2>How this works</h2>
<p>A slate carries the arrangement and nothing else: which widgets are on the grid
and where they sit. It holds no calendars, no locations and no accounts, so
whoever applies one points the widgets at their own. &ldquo;Use this layout&rdquo;
opens the extension with the slate in the link and shows you the result before
anything changes.</p>
<p>To share yours, open Settings &rarr; Widgets in the extension and press
<strong>Share this layout</strong>.</p>
</section>
</main>
</div>

<script>
// Progressive enhancement: the link works without this, the copy button is extra.
document.querySelectorAll('.copy').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.code)
      button.textContent = 'Copied'
      button.dataset.done = '1'
      setTimeout(() => { button.textContent = 'Copy code'; delete button.dataset.done }, 2000)
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
