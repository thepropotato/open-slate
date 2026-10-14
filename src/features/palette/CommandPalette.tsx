import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/core/icons'
import { useAsyncValue, useClosing } from '@/core/hooks'
import { openUrl, searchDefault } from '@/core/platform/browser'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { asDestination } from '@/features/search/destination'
import { queryLocal, type Suggestion, type SuggestionKind } from '@/features/search/providers'
import { faviconUrl } from '@/core/platform/browser'
import { buildActions, matchAction } from './actions'
import { loadRecent, pushRecent } from './recent'
import { listScenes } from '@/core/settings/scenes'
import './CommandPalette.css'

/**
 * One box for tabs, tiles, bookmarks, history, settings commands and a web
 * search fallback. Ranking is shared with the search bar's provider scoring.
 */
export function CommandPalette({
  onClose,
  onOpenSettings,
  onArrange,
  onTour,
}: {
  onClose: () => void
  /** Opens settings in place; falls back to the options page when absent. */
  onOpenSettings?: () => void
  onArrange?: () => void
  onTour?: () => void
}) {
  const { closing, handleClose } = useClosing(onClose, 150)
  const settings = useSettings()
  const actions = useSettingsActions()
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const needle = query.trim().toLowerCase()

  const scenes = useAsyncValue('scenes', listScenes)

  const commands = useMemo(
    () => buildActions(settings, actions, onOpenSettings, onArrange, scenes ?? [], onTour),
    [settings, actions, onOpenSettings, onArrange, scenes, onTour],
  )

  const local = useAsyncValue(needle.length > 0 ? `palette:${needle}` : null, () =>
    queryLocal(query, { tiles: settings.tiles.items, limit: 12 }),
  )

  const [recent] = useState(loadRecent)

  const groups = useMemo<Group[]>(() => {
    const matched = commands
      .map((command) => matchAction(command, needle))
      .filter((item): item is Suggestion => item !== null)

    if (!needle) {
      const back: Suggestion[] = recent.map((entry, index) => ({
        id: `recent:${index}:${entry.url}`,
        kind: entry.kind,
        title: entry.title,
        subtitle: entry.subtitle,
        url: entry.url,
        image: entry.image ?? (entry.url ? faviconUrl(entry.url, 32) : undefined),
        score: 0,
        run: () => openUrl(entry.url ?? '', settings.tiles.openIn),
      }))
      const common = commands
        .filter((command) => command.common)
        .map((command) => matchAction(command, ''))
        .filter((item): item is Suggestion => item !== null)
      return [
        { label: 'Recent', items: back },
        { label: 'Actions', items: common },
      ].filter((group) => group.items.length > 0)
    }

    const byKind = new Map<SuggestionKind, Suggestion[]>()
    for (const item of [...(local ?? []), ...matched].sort((a, b) => b.score - a.score)) {
      byKind.set(item.kind, [...(byKind.get(item.kind) ?? []), item])
    }
    // Groups lead with whichever holds the best match, so the top hit is always first on screen.
    const ordered: Group[] = [...byKind.entries()]
      .sort((a, b) => b[1][0].score - a[1][0].score)
      .map(([kind, items]) => ({ label: GROUP_LABEL[kind], items: items.slice(0, 8) }))

    // A web search is always offered last, so no query is ever a dead end.
    const destination = asDestination(query)
    const term = query.trim()
    ordered.push({
      label: 'Search the web',
      items: [
        {
          id: 'fallback:search',
          kind: 'search',
          title: destination ? `Go to ${destination}` : `Search for “${term}”`,
          icon: destination ? 'link' : 'search',
          score: -1,
          run: () => {
            const where = settings.tiles.openIn
            if (destination) openUrl(destination, where)
            else if (!searchDefault(term, where)) {
              openUrl(`https://www.google.com/search?q=${encodeURIComponent(term)}`, where)
            }
          },
        },
      ],
    })
    return ordered
  }, [local, commands, needle, query, settings, recent])

  const results = useMemo(() => groups.flatMap((group) => group.items), [groups])

  // Clamped, not reset in an effect: no extra render to correct a shrunk list.
  const active = results.length === 0 ? 0 : Math.min(highlight, results.length - 1)

  // Keep the highlighted row on screen while arrowing through a long list.
  useEffect(() => {
    listRef.current?.querySelector(`[data-index='${active}']`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const commit = (index: number) => {
    const item = results[index]
    if (!item) return
    pushRecent(item)
    handleClose()
    void item.run()
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((current) => (current + 1) % Math.max(1, results.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((current) => (current - 1 + results.length) % Math.max(1, results.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      commit(active)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      handleClose()
    }
  }

  return (
    <div className="palette__scrim" onClick={handleClose} role="presentation" data-closing={closing || undefined}>
      <div
        className="palette surface"
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="palette__input">
          <Icon name="search" />
          <input
            ref={inputRef}
            value={query}
            autoFocus
            onChange={(event) => {
              setQuery(event.target.value)
              setHighlight(0)
            }}
            onKeyDown={onKeyDown}
            placeholder="Search tabs, bookmarks, history, or type a command"
            aria-label="Search or run a command"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>esc</kbd>
        </div>

        <ul className="palette__list scroll-y" ref={listRef}>
          {groups.map((group, groupIndex) => {
            const offset = groups.slice(0, groupIndex).reduce((total, g) => total + g.items.length, 0)
            return (
              <li key={group.label} className="palette__group">
                <p className="palette__section">{group.label}</p>
                <ul>
                  {group.items.map((item, index) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="palette__row"
                        data-active={offset + index === active}
                        data-index={offset + index}
                        onMouseMove={() => setHighlight(offset + index)}
                        onClick={() => commit(offset + index)}
                      >
                        <span className="palette__icon">
                          {item.image ? (
                            <img src={item.image} alt="" width={16} height={16} />
                          ) : item.icon ? (
                            <Icon name={item.icon} />
                          ) : null}
                        </span>
                        <span className="palette__text">
                          <span className="palette__title">{item.title}</span>
                          {item.subtitle ? <span className="palette__sub">{item.subtitle}</span> : null}
                        </span>
                        {item.shortcut ? (
                          <kbd className="palette__key">{item.shortcut}</kbd>
                        ) : kindLabel(item.kind) ? (
                          <span className="palette__kind">{kindLabel(item.kind)}</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
          {results.length === 0 ? (
            <li className="palette__empty">Start typing to search, or press escape.</li>
          ) : null}
        </ul>

        <footer className="palette__foot">
          <span>Up and down to move</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
        </footer>
      </div>
    </div>
  )
}

interface Group {
  label: string
  items: Suggestion[]
}

const GROUP_LABEL: Record<SuggestionKind, string> = {
  tab: 'Open tabs',
  tile: 'Tiles',
  bookmark: 'Bookmarks',
  history: 'History',
  action: 'Actions',
  search: 'Search the web',
}

const kindLabel = (kind: Suggestion['kind']): string =>
  ({
    tab: 'Tab',
    bookmark: 'Bookmark',
    history: 'History',
    tile: 'Tile',
    action: '',
    search: 'Search',
  })[kind]
