import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/core/ui'
import { Icon, type IconName } from '@/core/icons'
import { faviconUrl, isExtension } from '@/core/platform/browser'
import { useSettings } from '@/core/settings/SettingsProvider'
import { Tile } from '@/core/settings/schema'
import { flushSettings, loadSettings, saveSettings } from '@/core/settings/store'
import { uid } from '@/core/util/id'
import { hostOf } from '@/features/tiles/brand'
import { foldersIn, pageName, removeTile, tilePage } from '@/features/tiles/folders'
import { seedTilesFromBrowser } from '@/features/tiles/seed'
import { formatHostTitle } from '@/features/tiles/title'
import { popupActions } from './actions'
import './popup.css'

interface Page {
  url: string
  title: string
}

const addable = (url: string) => /^https?:\/\//i.test(url)

// Outside the extension (`npm run dev`) there is no active tab, so show a sample.
async function readActivePage(): Promise<Page | null> {
  if (!isExtension()) return { url: 'https://linear.app/team/issues', title: 'Issues' }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.url ? { url: tab.url, title: tab.title ?? '' } : null
}

const comparable = (url: string) => url.replace(/#.*$/, '').replace(/\/$/, '')

export function PopupApp() {
  const allSettings = useSettings()
  const { tiles } = allSettings
  const [page, setPage] = useState<Page | null | undefined>(undefined)
  const [scope, setScope] = useState<'page' | 'site'>('page')
  const [name, setName] = useState<string | null>(null)
  const [pageId, setPageId] = useState('')
  const [folderId, setFolderId] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'added' | 'removed'>('idle')

  useEffect(() => {
    void readActivePage().then(setPage)
  }, [])

  const target = useMemo(() => {
    if (!page || !addable(page.url)) return ''
    const url = new URL(page.url)
    return scope === 'site' ? url.origin : url.href.replace(/#.*$/, '')
  }, [page, scope])

  const host = target ? hostOf(target) : ''
  const title = name ?? formatHostTitle(host)
  // Already added counts for either the exact page or its whole site.
  const candidates = page && addable(page.url) ? [new URL(page.url).href, new URL(page.url).origin] : []
  const existing = tiles.items.find(
    (tile) => tile.kind === 'link' && candidates.some((url) => comparable(tile.url) === comparable(url)),
  )

  const folders = foldersIn(tiles.items).filter((folder) => tilePage(folder, tiles.pages) === pageId)
  const pageOptions = [
    { value: '', label: pageName(tiles.pages, '', 0) },
    ...tiles.pages.map((p, i) => ({ value: p.id, label: pageName(tiles.pages, p.id, i + 1) })),
  ]
  const folderOptions = [{ value: '', label: 'None' }, ...folders.map((f) => ({ value: f.id, label: f.title }))]

  const write = async (change: (items: Tile[]) => Tile[]) => {
    setStatus('saving')
    const current = await loadSettings()
    // A brand-new profile has not opened the new tab yet, so it would skip its first-run seed.
    const items = current.tiles.items.length > 0 ? current.tiles.items : await seedTilesFromBrowser()
    saveSettings({ ...current, tiles: { ...current.tiles, items: change(items) } })
    await flushSettings()
  }

  const add = async () => {
    const tile = Tile.parse({
      id: uid('tile'),
      url: target,
      title: title.trim() || formatHostTitle(host),
      pageId,
      parentId: folderId,
    })
    await write((items) => [...items, tile])
    setStatus('added')
    setTimeout(() => window.close(), 900)
  }

  const runAction = async (id: string) => {
    const action = popupActions.find((candidate) => candidate.id === id)
    if (!action) return
    await action.run(allSettings)
    if (!action.keepOpen) window.close()
  }

  const remove = async () => {
    if (!existing) return
    await write((items) => removeTile(items, existing.id))
    setStatus('removed')
    setTimeout(() => window.close(), 900)
  }

  if (page === undefined) return <main className="pop" />

  const done = status === 'added' || status === 'removed'
  const canAdd = Boolean(page && target)
  const version = isExtension() ? chrome.runtime.getManifest().version : 'dev'

  return (
    <main className="pop">
      <header className="pop__bar">
        <img className="pop__logo" src="/icons/icon48.png" alt="" width={28} height={28} />
        <div className="pop__brand">
          <strong>Open Slate</strong>
          <span>Add this page, or jump to anything</span>
        </div>
        <button type="button" className="pop__gear" title="Customise" aria-label="Customise" onClick={() => void runAction('customise')}>
          <Icon name="settings" />
        </button>
      </header>

      <section className="pop__section" aria-labelledby="pop-add">
        <h2 id="pop-add">This page</h2>
        {!canAdd || !page ? (
          <div className="pop__card pop__card--empty">
            <Icon name="info" />
            <p>Open a website, then come back here to add it as a tile on your new tab.</p>
          </div>
        ) : (
          <div className="pop__card">
            <div className="pop__page">
              <img className="pop__icon" src={faviconUrl(target, 64)} alt="" width={40} height={40} />
              <div className="pop__text">
                <strong>{page.title || host}</strong>
                <span>{host}</span>
              </div>
            </div>

            {done ? (
              <p className="pop__done">
                <Icon name="check" /> {status === 'added' ? 'Added to your new tab' : 'Removed from your new tab'}
              </p>
            ) : existing ? (
              <>
                <p className="pop__note">
                  <Icon name="check" /> Already on your new tab
                </p>
                <Button variant="danger" icon="remove" onClick={() => void remove()} disabled={status === 'saving'}>
                  Remove tile
                </Button>
              </>
            ) : (
              <form
                className="pop__form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void add()
                }}
              >
                <input
                  className="pop__input"
                  value={title}
                  onChange={(event) => setName(event.target.value)}
                  aria-label="Tile name"
                  placeholder="Name"
                />
                <div className="pop__picks">
                  <Pick
                    icon="link"
                    label="Link"
                    value={scope}
                    onChange={(next) => setScope(next as 'page' | 'site')}
                    options={[
                      { value: 'page', label: 'This page' },
                      { value: 'site', label: 'Whole site' },
                    ]}
                  />
                  {tiles.pages.length > 0 ? (
                    <Pick
                      icon="layout"
                      label="Page"
                      value={pageId}
                      onChange={(next) => {
                        setPageId(next)
                        setFolderId('')
                      }}
                      options={pageOptions}
                    />
                  ) : null}
                  {folders.length > 0 ? (
                    <Pick icon="folder" label="Folder" value={folderId} onChange={setFolderId} options={folderOptions} />
                  ) : null}
                </div>
                {tiles.enabled ? null : <p className="pop__note">Tiles are switched off in settings.</p>}
                <Button type="submit" variant="primary" icon="add" disabled={status === 'saving' || !title.trim()}>
                  Add to new tab
                </Button>
              </form>
            )}
          </div>
        )}
      </section>

      <section className="pop__section" aria-labelledby="pop-actions">
        <h2 id="pop-actions">Quick actions</h2>
        <div className="pop__grid">
          {popupActions.map((action) => {
            const hint = action.hint?.(allSettings)
            return (
              <button
                key={action.id}
                type="button"
                className="pop__action"
                title={hint ? `${action.label}: ${hint}` : action.label}
                onClick={() => void runAction(action.id)}
              >
                <Icon name={typeof action.icon === 'function' ? action.icon(allSettings) : action.icon} />
                <span>{action.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      <footer className="pop__foot">
        <span>
          <kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>S</kbd> adds this page
        </span>
        <span>v{version}</span>
      </footer>
    </main>
  )
}

/** A compact dropdown: the current choice shown as a pill, the native menu opens on click. */
function Pick({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: IconName
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const current = options.find((option) => option.value === value)?.label ?? ''
  return (
    <label className="pick">
      <Icon name={icon} />
      <span className="pick__text">
        <span className="pick__label">{label}</span>
        {current}
      </span>
      <Icon name="chevronDown" className="pick__chev" />
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
