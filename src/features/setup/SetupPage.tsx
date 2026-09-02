import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@/core/icons'
import { Button } from '@/core/ui'
import { isExtension } from '@/core/platform/browser'
import { allGuides, getGuide } from './registry'
import './setup.css'

/**
 * Two columns: the connectors down the side, the selected one filling the rest.
 *
 * Each connector is its own view rather than a section of one long page - the
 * steps for one are no help while following another, and a walkthrough is easier
 * to follow when its last step is the last thing on screen.
 */
export function SetupPage() {
  const guides = allGuides()
  const version = isExtension() ? chrome.runtime.getManifest().version : ''
  const initial = new URLSearchParams(window.location.search).get('guide')

  // The URL only seeds the choice; picking from the sidebar takes over from there.
  const [activeId, setActiveId] = useState(
    () => (getGuide(initial) ?? guides[0])?.id ?? '',
  )
  const active = getGuide(activeId)

  useEffect(() => {
    document.title = active ? `${active.title} · Open Slate` : 'Connectors · Open Slate'
  }, [active])

  // Deep links stay shareable, and Back steps between connectors rather than
  // leaving the page. `replaceState` on the seed so it does not add an entry.
  const select = useCallback((id: string) => {
    setActiveId(id)
    window.history.pushState({ guide: id }, '', `/setup.html?guide=${encodeURIComponent(id)}`)
  }, [])

  useEffect(() => {
    const onPop = () => {
      const id = new URLSearchParams(window.location.search).get('guide')
      setActiveId((getGuide(id) ?? guides[0])?.id ?? '')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [guides])

  return (
    <div className="setup-shell">
      <header className="setup__header">
        <h1 className="setup__apptitle">Connectors</h1>
        <Button
          icon="close"
          title="Back to new tab"
          variant="ghost"
          onClick={() => window.location.assign('/newtab.html')}
        />
      </header>

      <div className="setup">
        <aside className="setup__nav">
          <nav>
            {guides.map((g) => (
              <button
                key={g.id}
                type="button"
                className="setup__navitem"
                aria-current={g.id === activeId}
                onClick={() => select(g.id)}
              >
                <Icon name={g.icon} />
                <span>{g.title}</span>
              </button>
            ))}
          </nav>
          <p className="setup__navfoot">
            Each connector is set up on this device only.
          </p>
        </aside>

        <div className="setup__body scroll-y">
          {active ? (
            // Keyed, so switching connectors remounts rather than carrying a
            // half-filled field across.
            <div className="setup__pane" key={active.id}>
              <active.Component />
            </div>
          ) : (
            <p className="setup__empty">Nothing here needs connecting yet.</p>
          )}

          {/* Below the pane rather than in the sidebar: it explains the setup the
              reader has just been through, so it belongs at the end of it. */}
          <footer className="setup__footnote">
            <p>
              Sorry to make you do this. Open Slate has no server of its own. Everything lives
              in your browser, so there is nowhere for it to keep an account on your behalf.
            </p>
            <p>
              Services that expose a private feed like this one hand out access per registered
              application, and the free tiers are generally capped at a handful of named testers
              unless a company applies for a commercial allowance. An extension given away to
              everyone cannot fit inside that, so the alternative to these few minutes is not
              having the connector at all.
            </p>
            <p>
              The upside is that the access is yours: registered under your account, kept on this
              device, and revocable at any time without going through us.
            </p>

            <div className="setup__about">
              <img className="setup__logo" src="/icons/icon48.png" alt="" width="32" height="32" />
              <div className="setup__aboutbody">
                <p className="setup__aboutname">
                  Open Slate{version ? <span className="setup__version">{version}</span> : null}
                </p>
                <p>A customizable speed dial and dashboard for your new tab page.</p>
                <p className="setup__links">
                  <a href="https://github.com/thepropotato/open-slate" target="_blank" rel="noopener noreferrer">
                    Source <Icon name="external" />
                  </a>
                  <a href="https://github.com/thepropotato/open-slate/issues" target="_blank" rel="noopener noreferrer">
                    Report an issue <Icon name="external" />
                  </a>
                  <a href="https://github.com/thepropotato/open-slate/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
                    Licence <Icon name="external" />
                  </a>
                </p>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  )
}
