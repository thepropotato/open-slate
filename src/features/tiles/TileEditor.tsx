import { useEffect, useMemo, useState } from 'react'
import { useAsyncValue } from '@/core/hooks'
import { Icon } from '@/core/icons'
import { Button, ColorInput, Modal, Row, Segmented, Select, TextInput } from '@/core/ui'
import { measureMedia, mediaStore } from '@/core/storage/blobStore'
import { useSettings } from '@/core/settings/SettingsProvider'
import { Tile as TileSchema, type Tile as TileModel } from '@/core/settings/schema'
import { uid } from '@/core/util/id'
import { allBrands, hostOf, resolveBrand, type Brand } from './brand'
import { useTileVisual } from './useTileVisual'
import './TileEditor.css'

const IMAGE_KINDS = [
  { value: 'auto', label: 'Auto' },
  { value: 'brand', label: 'Brand logo' },
  { value: 'favicon', label: 'Favicon' },
  { value: 'url', label: 'Image URL' },
  { value: 'upload', label: 'Upload' },
  { value: 'monogram', label: 'Initials' },
] as const

/** Add or edit a single tile, with a live preview using the real tile renderer. */
export function TileEditor({
  tile,
  onSave,
  onClose,
  onDelete,
}: {
  tile: TileModel | null
  onSave: (tile: TileModel) => void
  onClose: () => void
  onDelete?: () => void
}) {
  const { tiles } = useSettings()
  const [draft, setDraft] = useState<TileModel>(
    () => tile ?? TileSchema.parse({ id: uid('tile'), url: '' }),
  )
  const [brandQuery, setBrandQuery] = useState('')
  const [brands, setBrands] = useState<Brand[]>([])

  const patch = (changes: Partial<TileModel>) => setDraft((d) => ({ ...d, ...changes }))
  const patchImage = (changes: Partial<TileModel['image']>) =>
    setDraft((d) => ({ ...d, image: { ...d.image, ...changes } }))

  useEffect(() => {
    if (draft.image.kind !== 'brand') return
    let alive = true
    void allBrands().then((list) => alive && setBrands(list))
    return () => {
      alive = false
    }
  }, [draft.image.kind])


  const filteredBrands = useMemo(() => {
    const needle = brandQuery.trim().toLowerCase()
    const list = needle ? brands.filter((b) => b.title.toLowerCase().includes(needle)) : brands
    return list.slice(0, 60)
  }, [brands, brandQuery])

  const normalisedUrl = normaliseUrl(draft.url)
  const valid = normalisedUrl.length > 0

  // Tells the user whether "Auto" will actually find a logo. Keyed on the
  // normalised URL, since "netflix.com" alone has no parsable host.
  const autoBrand = useAsyncValue(normalisedUrl ? `brand:${normalisedUrl}` : null, () =>
    resolveBrand(normalisedUrl),
  )

  const preview = { ...draft, url: normalisedUrl || 'https://example.com' }

  const onUpload = async (file: File | undefined) => {
    if (!file) return
    const id = uid('img')
    const { width, height } = await measureMedia(file)
    await mediaStore.put({ id, name: file.name, type: file.type, size: file.size, width, height, blob: file })
    patchImage({ kind: 'upload', blobId: id })
  }

  return (
    <Modal
      title={tile ? 'Edit tile' : 'Add tile'}
      width={640}
      onClose={onClose}
      footer={
        <>
          {onDelete ? (
            <Button variant="danger" icon="remove" onClick={onDelete}>
              Delete
            </Button>
          ) : null}
          <span className="modal__spacer" />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="check"
            disabled={!valid}
            onClick={() => onSave({ ...draft, url: normalisedUrl })}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="tile-editor">
        <div className="tile-editor__preview">
          <div
            className="tiles"
            data-label-vis="always"
            data-favicon-vis={tiles.faviconVisibility === 'never' ? 'never' : 'always'}
            data-hover="none"
            data-plate={tiles.plateStyle}
            style={
              {
                '--tile-w': '150px',
                '--tile-aspect': tiles.aspect,
                '--tile-radius': tiles.radius === null ? 'var(--radius)' : `${tiles.radius}px`,
                '--tile-pad': `${tiles.imagePadding}px`,
                '--tile-fit': tiles.imageFit,
                '--favicon-size': `${tiles.faviconSize}px`,
                '--tile-cols': 1,
              } as React.CSSProperties
            }
          >
            <PreviewTile tile={preview} />
          </div>
          {autoBrand ? (
            <p className="tile-editor__hint">
              <Icon name="check" /> Brand logo available: {autoBrand.title}
            </p>
          ) : draft.url ? (
            <p className="tile-editor__hint">
              <Icon name="info" /> No brand logo for {hostOf(normalisedUrl) || 'this site'} — the
              favicon is used instead.
            </p>
          ) : null}
        </div>

        <div className="tile-editor__fields">
          <Row title="Address" stacked>
            <TextInput
              value={draft.url}
              onChange={(url) => patch({ url })}
              placeholder="example.com"
              wide
              type="url"
            />
          </Row>

          <Row title="Title" help="Leave empty to use the brand or host name.">
            <TextInput value={draft.title} onChange={(title) => patch({ title })} placeholder="Auto" />
          </Row>

          <Row title="Image" stacked>
            <Segmented
              value={draft.image.kind}
              onChange={(kind) => patchImage({ kind })}
              options={IMAGE_KINDS.map((k) => ({ value: k.value, label: k.label }))}
            />
          </Row>

          {draft.image.kind === 'brand' ? (
            <>
              <Row title="Find a brand" stacked>
                <TextInput
                  value={brandQuery}
                  onChange={setBrandQuery}
                  placeholder="Search brands"
                  wide
                  type="search"
                />
              </Row>
              <div className="brand-picker scroll-y">
                {filteredBrands.map((brand) => (
                  <button
                    key={brand.slug}
                    type="button"
                    className="brand-picker__item"
                    aria-pressed={draft.image.brandSlug === brand.slug}
                    onClick={() => patchImage({ brandSlug: brand.slug })}
                    title={brand.title}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ fill: brand.hex }}>
                      <path d={brand.path} />
                    </svg>
                    <span>{brand.title}</span>
                  </button>
                ))}
                {filteredBrands.length === 0 ? (
                  <p className="tile-editor__hint">No brand matches that name.</p>
                ) : null}
              </div>
            </>
          ) : null}

          {draft.image.kind === 'url' ? (
            <Row title="Image address" stacked>
              <TextInput
                value={draft.image.url}
                onChange={(url) => patchImage({ url })}
                placeholder="https://…/logo.svg"
                wide
                type="url"
              />
            </Row>
          ) : null}

          {draft.image.kind === 'upload' ? (
            <Row title="File" help="Stored locally in the browser, never uploaded anywhere.">
              <label className="ctl-btn">
                <Icon name="upload" />
                <span>{draft.image.blobId ? 'Replace' : 'Choose file'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => void onUpload(event.target.files?.[0])}
                />
              </label>
            </Row>
          ) : null}

          <Row title="Plate colour" help="Overrides the brand or sampled colour.">
            <div className="tile-editor__colour">
              <ColorInput
                value={draft.background ?? '#1b1e26'}
                onChange={(background) => patch({ background })}
              />
              <Button
                variant="ghost"
                onClick={() => patch({ background: null })}
                disabled={draft.background === null}
              >
                Auto
              </Button>
            </div>
          </Row>

          <Row title="Label" help="Overrides the global label position for this tile.">
            <Select
              value={draft.labelPlacement ?? 'inherit'}
              onChange={(value) =>
                patch({
                  labelPlacement:
                    value === 'inherit' ? null : (value as NonNullable<TileModel['labelPlacement']>),
                })
              }
              options={[
                { value: 'inherit', label: 'Follow global' },
                { value: 'below', label: 'Below tile' },
                { value: 'inside-bottom', label: 'Inside, bottom' },
                { value: 'inside-top', label: 'Inside, top' },
                { value: 'none', label: 'Hidden' },
              ]}
            />
          </Row>
        </div>
      </div>
    </Modal>
  )
}

/** Renders the preview through the same visual resolver the real grid uses. */
function PreviewTile({ tile }: { tile: TileModel }) {
  const { tiles } = useSettings()
  const visual = useTileVisual(tile, tiles)
  const placement = tile.labelPlacement ?? tiles.labelPlacement

  return (
    <div className="tile">
      <span
        className="tile__plate"
        style={{ background: visual.plate ?? 'transparent', color: visual.ink }}
      >
        {visual.art.kind === 'brand' ? (
          <svg className="tile__mark tile__mark--svg" viewBox="0 0 24 24" aria-hidden="true">
            <path d={visual.art.path} />
          </svg>
        ) : visual.art.kind === 'image' ? (
          <img className="tile__mark" src={visual.art.src} alt="" />
        ) : (
          <span className="tile__monogram">{visual.art.text}</span>
        )}
        <img
          className="tile__favicon"
          data-corner={tiles.faviconCorner}
          src={visual.faviconSrc}
          alt=""
        />
        {placement === 'inside-bottom' || placement === 'inside-top' ? (
          <span
            className={`tile__label tile__label--inside tile__label--${placement}`}
            style={{ color: '#fff' }}
          >
            {visual.title}
          </span>
        ) : null}
      </span>
      {placement === 'below' ? (
        <span className="tile__label tile__label--below">{visual.title}</span>
      ) : null}
    </div>
  )
}

/** Accepts bare hosts, so "github.com" becomes a usable URL. */
function normaliseUrl(input: string): string {
  const value = input.trim()
  if (!value) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value
  if (!/^[^\s/]+\.[^\s/]{2,}/.test(value)) return ''
  return `https://${value}`
}
