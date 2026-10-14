// Head, nav and footer shared by the site's secondary pages (privacy, changelog, slates).

const STORE_URL = 'https://chromewebstore.google.com/detail/kbacclgoobafnkifgckaenacaeghfonm'

const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

export function pageHead({ title, description, path }) {
  const url = `https://openslate.byvenu.com/${path}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index, follow">

<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:image" content="https://openslate.byvenu.com/img/og.png">
<meta property="og:site_name" content="Open Slate">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=Caveat:wght@500;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="site.css">
<script>document.documentElement.className += ' js'</script>
<script src="site.js" defer></script>
</head>
<body>
`
}

const NAV_LINKS = [
  ['/#features', 'Features'],
  ['/slates', 'Slates'],
  ['/privacy', 'Privacy'],
  ['/changelog', 'Changelog'],
]

/** `current` is the page's own path, marked so the header shows where you are. */
export function nav(current) {
  const links = NAV_LINKS.map(
    ([href, label]) => `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`,
  ).join('\n        ')
  return `<header class="site-header">
  <div class="wrap">
    <nav class="nav" aria-label="Main">
      <a class="brand" href="/"><img class="logo" src="/favicon.svg" alt="" width="28" height="28">Open Slate</a>
      <div class="nav-links">
        ${links}
        <a class="btn" href="${STORE_URL}">Add to Chrome</a>
      </div>
    </nav>
  </div>
</header>
`
}

export const footer = `<footer>
  <div class="wrap">
    <a class="brand" href="/"><img class="logo" src="/favicon.svg" alt="" width="28" height="28">Open Slate</a>
    <a href="/privacy">Privacy</a>
    <a href="/changelog">Changelog</a>
    <a href="/slates">Slates</a>
    <a href="https://github.com/thepropotato/open-slate">Source</a>
    <a href="https://github.com/thepropotato/open-slate/issues">Issues</a>
    <a href="https://github.com/thepropotato/open-slate/blob/main/LICENSE">Licence</a>
  </div>
</footer>
`
