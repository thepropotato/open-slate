import { useEffect, useState } from 'react'
import { Icon } from '@/core/icons'
import { Button } from '@/core/ui'
import { useDraftActions } from '@/core/settings/SettingsProvider'
import './SaveBar.css'

/**
 * Save / discard for the pending edits, shown only when something differs.
 *
 * Holding edits until confirmed is what gives a knob an undo: turning a radius
 * from 62 to 20 otherwise destroys the 62.
 */
export function SaveBar() {
  const { changed, dirty, save, discard } = useDraftActions()
  const count = changed.length

  // Set by the save itself, not derived from `dirty` going false — that would
  // light up for a discard too, the one case it has to distinguish.
  const [justSaved, setJustSaved] = useState(false)
  useEffect(() => {
    if (!justSaved) return
    const timer = setTimeout(() => setJustSaved(false), 1600)
    return () => clearTimeout(timer)
  }, [justSaved])

  const commit = () => {
    save()
    setJustSaved(true)
  }

  // The draft outlives the panel but not the tab, so only unload is worth warning on.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    if (!dirty) return
    // Bound only while pending, so it doesn't shadow the browser's own save.
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        commit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // `commit` is recreated every render; `save` is the dependency that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, save])

  if (!dirty) {
    return justSaved ? (
      <div className="savebar savebar--done" role="status">
        <Icon name="check" />
        <span>Saved</span>
      </div>
    ) : null
  }

  return (
    <div className="savebar" role="region" aria-label="Unsaved changes">
      <p className="savebar__count">
        <span className="savebar__dot" aria-hidden="true" />
        {count} unsaved {count === 1 ? 'change' : 'changes'}
      </p>
      <div className="savebar__actions">
        <Button variant="primary" icon="check" onClick={commit}>
          Save
        </Button>
        <Button
          variant="ghost"
          icon="reset"
          onClick={() => {
            setJustSaved(false)
            discard()
          }}
          title="Discard unsaved changes"
        >
          Discard
        </Button>
      </div>
    </div>
  )
}
