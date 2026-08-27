import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@/core/icons'
import { useAsyncValue } from '@/core/hooks'
import { faviconUrl, openUrl } from '@/core/platform/browser'
import { useSettings } from '@/core/settings/SettingsProvider'
import { asDestination, buildSearchUrl, getEngine, parseQuery, searchEngines } from './engines'
import { calculate } from './calculator'
import { queryLocal, type Suggestion } from './providers'
import './SearchBar.css'

/**
 * The search band.
 *
 * One box handles four things, in this order of precedence: an arithmetic
 * expression, something that is already an address, a bang-prefixed query, and
 * finally a plain search. Suggestions come from the user's own tabs, tiles,
 * bookmarks and history — never from a remote suggestion service.
 */
export function SearchBar() {
  const { search, tiles, behavior } = useSettings()
  const [value, setValue] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const [engineOpen, setEngineOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(
    () => parseQuery(value, search.engineId, search.bangs),
    [value, search.engineId, search.bangs],
  )
  const destination = useMemo(() => asDestination(value), [value])
  const maths = useMemo(() => (search.calculator ? calculate(value) : null), [value, search.calculator])

  const suggestions =
    useAsyncValue(search.suggestions && value.trim().length > 1 ? `q:${value}` : null, () =>
      queryLocal(value, { tiles: tiles.items, limit: 6 }),
    ) ?? []

  useEffect(() => {
    if (search.autofocus) inputRef.current?.focus()
  }, [search.autofocus])

  // "/" focuses the box from anywhere on the page, as it does in most web apps.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      event.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Keep the highlight inside the list as it shrinks.
  const maxIndex = suggestions.length - 1
  const activeIndex = Math.min(highlight, maxIndex)

  const submit = () => {
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      void suggestions[activeIndex].run()
      return
    }
    if (maths && !destination) {
      void navigator.clipboard?.writeText(maths).catch(() => undefined)
      return
    }
    if (destination) {
      openUrl(destination, tiles.openIn)
      return
    }
    if (!parsed.query && !parsed.bang) return
    openUrl(buildSearchUrl(parsed), tiles.openIn)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((current) => Math.min(current + 1, maxIndex))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((current) => Math.max(current - 1, -1))
    } else if (event.key === 'Escape') {
      if (value) {
        setValue('')
        setHighlight(-1)
      } else {
        inputRef.current?.blur()
      }
    } else if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  }

  if (!search.enabled) return null

  const engine = parsed.engine
  const placeholder = search.placeholder || `Search ${getEngine(search.engineId).name}`

  return (
    <div className="searchband">
      <div className="search" style={{ maxWidth: search.width }}>
        <div className="search__row surface" style={{ minHeight: search.height }}>
          {search.showEnginePicker ? (
            <div className="search__engine">
              <button
                type="button"
                className="search__enginebtn"
                onClick={() => setEngineOpen((open) => !open)}
                title={`Search with ${engine.name}`}
                aria-expanded={engineOpen}
              >
                <img src={faviconUrl(engine.home, 32)} alt="" width={18} height={18} />
                <Icon name="caretDown" />
              </button>
              {engineOpen ? (
                <ul className="search__enginelist surface">
                  {searchEngines.map((option) => (
                    <li key={option.id}>
                      <button
                        type="button"
                        className="search__engineitem"
                        aria-pressed={option.id === search.engineId}
                        onClick={() => {
                          setEngineOpen(false)
                          // A one-off engine choice: written into the query as a
                          // bang so the persisted default is left alone.
                          setValue((current) => `!${option.bangs[0]} ${stripBang(current)}`)
                          inputRef.current?.focus()
                        }}
                      >
                        <img src={faviconUrl(option.home, 32)} alt="" width={16} height={16} />
                        <span>{option.name}</span>
                        <span className="search__bang">!{option.bangs[0]}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <Icon name="search" className="search__icon" />
          )}

          <input
            ref={inputRef}
            className="search__input"
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setHighlight(-1)
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            aria-label="Search the web"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
          />

          {parsed.bang ? <span className="search__chip">{engine.name}</span> : null}
          {destination ? (
            <span className="search__chip">
              <Icon name="link" /> Go
            </span>
          ) : null}

          {value ? (
            <button
              type="button"
              className="search__clear"
              onClick={() => {
                setValue('')
                inputRef.current?.focus()
              }}
              title="Clear"
              aria-label="Clear the search box"
            >
              <Icon name="close" />
            </button>
          ) : null}
        </div>

        {maths || suggestions.length > 0 ? (
          <ul className="search__results surface">
            {maths ? (
              <li>
                <button type="button" className="search__result" onClick={submit}>
                  <span className="search__resulticon">
                    <Icon name="calculator" />
                  </span>
                  <span className="search__resulttext">
                    <span className="search__resulttitle">= {maths}</span>
                    <span className="search__resultsub">Enter copies the result</span>
                  </span>
                </button>
              </li>
            ) : null}

            {suggestions.map((item, index) => (
              <li key={item.id}>
                <SuggestionRow
                  item={item}
                  active={index === activeIndex}
                  onHover={() => setHighlight(index)}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {behavior.commandPalette ? (
        <p className="searchband__hint">
          Press <kbd>/</kbd> to search, <kbd>{modifierLabel()}K</kbd> for everything
        </p>
      ) : null}
    </div>
  )
}

function SuggestionRow({
  item,
  active,
  onHover,
}: {
  item: Suggestion
  active: boolean
  onHover: () => void
}) {
  return (
    <button
      type="button"
      className="search__result"
      data-active={active}
      onMouseEnter={onHover}
      onClick={() => void item.run()}
    >
      <span className="search__resulticon">
        {item.image ? <img src={item.image} alt="" width={16} height={16} /> : null}
      </span>
      <span className="search__resulttext">
        <span className="search__resulttitle">{item.title}</span>
        {item.subtitle ? <span className="search__resultsub">{item.subtitle}</span> : null}
      </span>
      <span className="search__resultkind">
        {item.icon ? <Icon name={item.icon} /> : null}
      </span>
    </button>
  )
}

const stripBang = (value: string): string => value.replace(/^!\w+\s*/, '').trim()

const modifierLabel = (): string =>
  navigator.userAgent.includes('Mac') ? 'Cmd' : 'Ctrl'
