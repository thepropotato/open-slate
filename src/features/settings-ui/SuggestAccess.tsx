import { useAsyncValue } from '@/core/hooks'
import { hasSuggestAccess, requestSuggestAccess } from '@/features/search/suggest'
import { Button } from '@/core/ui/controls'

/**
 * Chrome only prompts for a host permission on a user gesture, so an ungranted
 * suggest endpoint needs this button — typing alone can never raise the prompt.
 */
export function SuggestAccess() {
  const granted = useAsyncValue('suggest-access', hasSuggestAccess)

  if (granted === null || granted) return null

  return (
    <div className="field__help">
      <p>Suggestions as you type need access to the completions endpoint.</p>
      <Button
        icon="check"
        onClick={() => void requestSuggestAccess().then(() => window.location.reload())}
      >
        Allow
      </Button>
    </div>
  )
}
