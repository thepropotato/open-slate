import { useMemo, useState } from 'react'
import { Icon } from '@/core/icons'
import { Button } from '@/core/ui'
import { SettingsOverride, useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { ThemeScope } from '@/core/theme/ThemeProvider'
import { derivePanes, PageShell } from '@/newtab/PageShell'
import { applySlate, decodeSlate } from '@/core/settings/slateCode'
import { getWidget } from '@/core/widgets/registry'
import { uid } from '@/core/util/id'
import './slates.css'

/**
 * What a slate from the gallery would look like here, before anything changes.
 *
 * The gallery lives on the website, where it can show a slate but not what that
 * slate would do to *your* new tab: your theme, your wallpaper, your window. A
 * link here closes that gap without the extension ever fetching anything - the
 * slate travels in the URL, so this is a navigation rather than a request, and
 * the gallery needs no access to the browser at all.
 *
 * A URL is written by whoever sends it, so nothing here applies on arrival. The
 * page renders the slate under a `SettingsOverride`, whose actions are inert,
 * and applying is a button the reader presses after seeing the result.
 */
export function SlatePreviewPage() {
  const settings = useSettings()
  const { replace } = useSettingsActions()
  const [applied, setApplied] = useState(false)

  const params = new URLSearchParams(window.location.search)
  const code = params.get('code') ?? ''
  // Shown as the slate's name and author only. Never trusted for anything else:
  // these arrive in a link and are rendered as text, nothing more.
  const name = (params.get('name') ?? '').slice(0, 60)
  const credit = (params.get('by') ?? '').slice(0, 60)

  const outcome = useMemo(() => {
    if (!code) return { error: 'That link carries no slate.' }
    try {
      const payload = decodeSlate(code)
      if (payload.widgets.length === 0) return { error: 'That slate has no widgets in it.' }
      // Previewed against the real settings, so the reader sees their own theme
      // and wallpaper rather than a generic page.
      const preview = applySlate(settings, code, uid, (type) => getWidget(type) !== undefined)
      const missing = payload.widgets.filter((widget) => !getWidget(widget.type)).length
      return { preview, count: payload.widgets.length - missing, missing }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'That slate could not be read.' }
    }
  }, [code, settings])

  const apply = () => {
    if (!('preview' in outcome) || !outcome.preview) return
    replace(outcome.preview)
    setApplied(true)
  }

  if ('error' in outcome && outcome.error) {
    return (
      <div className="slatepv slatepv--bad">
        <Icon name="warning" />
        <h1>{outcome.error}</h1>
        <p>Check the link, or copy the slate code and paste it into Settings → Widgets.</p>
        <Button onClick={() => window.location.assign('/newtab.html')}>Go to the new tab</Button>
      </div>
    )
  }

  const { preview, count, missing } = outcome as {
    preview: typeof settings
    count: number
    missing: number
  }

  return (
    <div className="slatepv">
      <header className="slatepv__head">
        <div>
          <p className="slatepv__kicker">A slate for your new tab</p>
          <h1>{name || 'Untitled layout'}</h1>
          <p className="slatepv__by">
            {credit ? `Shared by ${credit}. ` : ''}
            {count === 1 ? '1 widget' : `${count} widgets`}
            {missing > 0
              ? `, and ${missing === 1 ? 'one this version does not have' : `${missing} this version does not have`}`
              : ''}
            . Your tiles, notes and tasks are not touched.
          </p>
        </div>
        <div className="slatepv__actions">
          {applied ? (
            <>
              <span className="slatepv__done">
                <Icon name="check" /> Applied
              </span>
              <Button variant="primary" onClick={() => window.location.assign('/newtab.html')}>
                Open the new tab
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => window.location.assign('/newtab.html')}>
                Not now
              </Button>
              <Button variant="primary" icon="check" onClick={apply}>
                Use this layout
              </Button>
            </>
          )}
        </div>
      </header>

      {/* The real page under the slate's settings, not a drawing of one.
          Inert throughout: a picture of the page must not be a second place to
          click or a keyboard detour on the way to the button that matters. */}
      <div className="slatepv__stage">
        <div className="slatepv__inert" aria-hidden="true" inert>
          <ThemeScope appearance={preview.appearance} className="slatepv__frame">
            <SettingsOverride settings={preview}>
              <PageShell active={derivePanes(preview)[0] ?? 'widgets'} />
            </SettingsOverride>
          </ThemeScope>
        </div>
      </div>
    </div>
  )
}
