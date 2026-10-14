import { googleFontUrl } from './fonts'

const loading = new Map<string, Promise<boolean>>()

function addSheet(href: string): Promise<boolean> {
  return new Promise((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => resolve(true)
    link.onerror = () => {
      link.remove()
      resolve(false)
    }
    document.head.append(link)
  })
}

/**
 * Loads a Google font into this page. Asks for the weights the interface uses and falls back to the
 * family's own default when it has no such range. Resolves false when Google has no such family
 * or the network is down.
 */
export function loadGoogleFont(name: string): Promise<boolean> {
  const known = loading.get(name)
  if (known) return known

  const attempt = (async () => {
    const ok = (await addSheet(googleFontUrl(name))) || (await addSheet(googleFontUrl(name, false)))
    if (!ok) return false
    // The sheet can exist while no face matches, so ask the browser whether one loaded.
    const faces = await document.fonts.load(`16px "${name}"`)
    return faces.length > 0
  })()

  loading.set(name, attempt)
  void attempt.then((ok) => {
    if (!ok) loading.delete(name)
  })
  return attempt
}
