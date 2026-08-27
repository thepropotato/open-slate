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
  | { kind: 'monogram'; text: string; colour: string }

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
export function useTileVisual(tile: Tile, settings: TilesSettings): TileVisual {
  const palette = usePalette()
  const host = hostOf(tile.url)
  const faviconSrc = useMemo(() => faviconUrl(tile.url, 64), [tile.url])

  const kind = tile.image.kind
  const wantsBrand = kind === 'auto' || kind === 'brand'

  const brand = useAsyncValue(
    wantsBrand && tile.url ? `brand:${tile.url}:${tile.image.brandSlug}` : null,
    () => resolveBrand(tile.url, tile.image.brandSlug),
  )

  const blobUrl = useAsyncValue(
    kind === 'upload' && tile.image.blobId ? `blob:${tile.image.blobId}` : null,
    () => mediaStore.url(tile.image.blobId),
  )

  // Only sample the favicon when its colour would actually be used.
  const needsTint = !tile.background && !brand && settings.plateStyle !== 'transparent'
  const tint = useAsyncValue(needsTint && host ? `tint:${host}` : null, () =>
    faviconTint(host, faviconSrc),
  )

  return useMemo(() => {
    const title = tile.title || brand?.title || host
    const brandColour = tile.background ?? brand?.hex ?? tint ?? null

    let plate: string | null
    let ink: string

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
                : { kind: 'image', src: faviconSrc }

    return { faviconSrc, plate, ink, art, title }
  }, [tile, brand, tint, blobUrl, kind, host, faviconSrc, settings.plateStyle, palette])
}
