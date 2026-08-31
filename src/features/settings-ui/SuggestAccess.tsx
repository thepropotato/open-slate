import { useAsyncValue } from '@/core/hooks'
import { useSettings } from '@/core/settings/SettingsProvider'
import { getEngine } from '@/features/search/engines'
import { hasSuggestAccess, hasWebSuggestions, requestSuggestAccess } from '@/features/search/suggest'
import { Button } from '@/core/ui/controls'

/**
 * Chrome only prompts for a host permission on a user gesture, so an engine
 * whose suggest endpoint is not yet granted needs this button — typing alone
 * can never raise the prompt.
 */
export function SuggestAccess() {
  const { search } = useSettings()
  const engine = getEngine(search.engineId)
  const supported = hasWebSuggestions(engine.id)

  const granted = useAsyncValue(supported ? `suggest-access:${engine.id}` : null, () =>
    hasSuggestAccess(engine.id),
  )

  if (!supported) {
    return <p className="field__help">{engine.name} does not publish a suggestions endpoint.</p>
  }
  if (granted === null || granted) return null

  return (
    <div className="field__help">
      <p>Suggestions from {engine.name} need access to its endpoint.</p>
      <Button
        icon="check"
        onClick={() => void requestSuggestAccess(engine.id).then(() => window.location.reload())}
      >
        Allow
      </Button>
    </div>
  )
}
