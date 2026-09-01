/**
 * Serves marketing/site the way Vercel does, so a link that works here works
 * deployed. `cleanUrls` in vercel.json means /privacy is privacy.html, and
 * without that the two changelog and privacy links 404 locally only.
 *
 *   npm run site        (regenerates the changelog page first)
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../marketing/site')
const port = Number(process.env.PORT) || 4178

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

const readable = async (path) => {
  try {
    return (await stat(path)).isFile() ? path : null
  } catch {
    return null
  }
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`)
  // Anything that climbs out of the site directory is refused rather than served.
  const rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '')
  const base = join(root, rel)

  const path =
    (await readable(base)) ??
    (await readable(`${base}.html`)) ??
    (await readable(join(base, 'index.html')))

  if (!path) {
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
    return
  }

  res.writeHead(200, {
    'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
    // Always revalidate: this exists to look at edits immediately.
    'Cache-Control': 'no-store',
  })
  res.end(await readFile(path))
}).listen(port, () => {
  console.log(`\n  Open Slate site  →  http://localhost:${port}\n`)
  console.log(`  /            the landing page`)
  console.log(`  /privacy     the privacy policy`)
  console.log(`  /changelog   the generated changelog\n`)
})
