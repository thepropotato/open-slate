import { useMemo } from 'react'
import { faviconUrl } from '@/core/platform/browser'
import { useAsyncValue } from '@/core/hooks'
import { mediaStore } from '@/core/storage/blobStore'
import { usePalette } from '@/core/theme/ThemeProvider'
import { ensureContrast, mix, readableOn } from '@/core/theme/color'
import type { Tile, Tiles as TilesSettings } from '@/core/settings/schema'
import { faviconTint, hostOf, monogram, resolveBrand } from './brand'

export type TileArt =
  | { kind: 'brand'; path: string; colour: string }
  | { kind: 'image'; src: string }
  /*
   * A site icon standing in for artwork. Kept separate from `image` because a
   * favicon is a tiny source bitmap: it is drawn near its own size and never
   * cropped, where a real image fills the plate however the user asked.
   */
  | { kind: 'favicon'; src: string }
  | { kind: 'monogram'; text: string; colour: string }
  /** A folder shows a small grid of the favicons it contains. */
  | { kind: 'folder'; icons: string[]; count: number }

export interface TileVisual {
  faviconSrc: string
  /** CSS colour for the plate, or null when the plate is transparent. */
  plate: string | null
  /** Colour for the label and any mark drawn on the plate. */
  ink: string
  art: TileArt
  title: string
}

/**
 * Turns a tile plus the global tile settings into everything needed to paint it.
 *
 * The favicon is available synchronously, so a tile is never blank: brand logos,
 * uploaded images and sampled plate colours all arrive later and swap in.
 */
export function useTileVisual(
  tile: Tile,
  settings: TilesSettings,
  /** URLs of a folder's contents, used to draw its preview. */
  childUrls: string[] = [],
): TileVisual {
  const palette = usePalette()
  const host = hostOf(tile.url)
  const faviconSrc = useMemo(() => faviconUrl(tile.url, 64), [tile.url])
  // The artwork copy asks for the largest icon the cache might hold, so the
  // slightly bigger on-plate rendering still has real pixels behind it.
  const faviconArt = useMemo(() => faviconUrl(tile.url, 128), [tile.url])

  const isFolder = tile.kind === 'folder'
  const kind = tile.image.kind
  const wantsBrand = !isFolder && (kind === 'auto' || kind === 'brand')

  const brand = useAsyncValue(
    wantsBrand && tile.url ? `brand:${tile.url}:${tile.image.brandSlug}` : null,
    () => resolveBrand(tile.url, tile.image.brandSlug),
  )

  const blobUrl = useAsyncValue(
    kind === 'upload' && tile.image.blobId ? `blob:${tile.image.blobId}` : null,
    () => mediaStore.url(tile.image.blobId),
  )

  // Only sample the favicon when its colour would actually be used.
  const needsTint =
    !isFolder && !tile.background && !brand && settings.plateStyle !== 'transparent'
  const tint = useAsyncValue(needsTint && host ? `tint:${host}` : null, () =>
    faviconTint(host, faviconSrc),
  )

  // A stable key for the child list, so the memo below is not defeated by a new
  // array arriving on every render.
  const childKey = childUrls.join('|')

  return useMemo(() => {
    const title = tile.title || brand?.title || host
    const brandColour = tile.background ?? brand?.hex ?? tint ?? null

    let plate: string | null
    let ink: string

    if (isFolder) {
      plate = tile.background ?? palette.bgElevated
      return {
        faviconSrc,
        plate: settings.plateStyle === 'transparent' ? null : plate,
        ink: readableOn(plate),
        art: {
          kind: 'folder',
          icons: (childKey ? childKey.split('|') : []).slice(0, 4).map((url) => faviconUrl(url, 32)),
          count: childKey ? childKey.split('|').length : 0,
        },
        title: tile.title || 'Folder',
      }
    }

    switch (settings.plateStyle) {
      case 'transparent':
        plate = null
        ink = brandColour ? ensureContrast(brandColour, palette.bg, 3) : palette.fg
        break
      case 'neutral':
        plate = palette.bgElevated
        ink = brandColour ? ensureContrast(brandColour, palette.bgElevated, 3) : palette.fg
        break
      case 'tinted':
        plate = brandColour ? mix(palette.bgElevated, brandColour, 0.22) : palette.bgElevated
        ink = brandColour ? ensureContrast(brandColour, plate, 3) : palette.fg
        break
      default:
        plate = brandColour ?? palette.bgElevated
        ink = readableOn(plate)
    }

    const art: TileArt =
      kind === 'monogram'
        ? { kind: 'monogram', text: monogram(tile.url, tile.title), colour: ink }
        : blobUrl
          ? { kind: 'image', src: blobUrl }
          : kind === 'url' && tile.image.url
            ? { kind: 'image', src: tile.image.url }
            : brand
              ? { kind: 'brand', path: brand.path, colour: ink }
              : kind === 'brand'
                ? { kind: 'monogram', text: monogram(tile.url, tile.title), colour: ink }
                : { kind: 'favicon', src: faviconArt }

    return { faviconSrc, plate, ink, art, title }
  }, [tile, brand, tint, blobUrl, kind, host, faviconSrc, faviconArt, settings.plateStyle, palette, isFolder, childKey])
}
