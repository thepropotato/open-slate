import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/core/icons'
import { useAsyncValue } from '@/core/hooks'
import { openUrl, searchDefault } from '@/core/platform/browser'
import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { asDestination } from '@/features/search/destination'
import { queryLocal, type Suggestion } from '@/features/search/providers'
import { buildActions, matchAction } from './actions'
import './CommandPalette.css'

/**
 * One box for tabs, tiles, bookmarks, history, settings commands and a web
 * search fallback. Ranking is shared with the search bar's provider scoring.
 */
export function CommandPalette({
  onClose,
  onOpenSettings,
}: {
  onClose: () => void
  /** Opens settings in place; falls back to the options page when absent. */
  onOpenSettings?: () => void
}) {
  const settings = useSettings()
  const actions = useSettingsActions()
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const needle = query.trim().toLowerCase()

  const commands = useMemo(
    () => buildActions(settings, actions, onOpenSettings),
    [settings, actions, onOpenSettings],
  )

  const local = useAsyncValue(needle.length > 0 ? `palette:${needle}` : null, () =>
    queryLocal(query, { tiles: settings.tiles.items, limit: 12 }),
  )

  const results = useMemo(() => {
    const matched = commands
      .map((command) => matchAction(command, needle))
      .filter((item): item is Suggestion => item !== null)

    const items = [...(local ?? []), ...matched].sort((a, b) => b.score - a.score)

    // A web search is always offered last, so no query is ever a dead end.
    if (needle) {
      const destination = asDestination(query)
      const term = query.trim()
      items.push({
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
      })
    }

    return items.slice(0, 40)
  }, [local, commands, needle, query, settings])

  // Clamped, not reset in an effect: no extra render to correct a shrunk list.
  const active = results.length === 0 ? 0 : Math.min(highlight, results.length - 1)

  // Keep the highlighted row on screen while arrowing through a long list.
  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const commit = (index: number) => {
    const item = results[index]
    if (!item) return
    onClose()
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
      onClose()
    }
  }

  return (
    <div className="palette__scrim" onClick={onClose} role="presentation">
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
          {results.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                className="palette__row"
                data-active={index === active}
                onMouseMove={() => setHighlight(index)}
                onClick={() => commit(index)}
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
                <span className="palette__kind">{kindLabel(item.kind)}</span>
              </button>
            </li>
          ))}
          {results.length === 0 ? (
            <li className="palette__empty">Start typing to search, or press escape.</li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}

const kindLabel = (kind: Suggestion['kind']): string =>
  ({
    tab: 'Tab',
    bookmark: 'Bookmark',
    history: 'History',
    tile: 'Tile',
    action: 'Command',
    search: 'Search',
  })[kind]
