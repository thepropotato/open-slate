import { useEffect, useRef } from 'react'
import { Button } from '@/core/ui'
import { useSettingsActions } from '@/core/settings/SettingsProvider'
import { isExtension } from '@/core/platform/browser'
import { SettingsPanel } from './SettingsPanel'
import './SettingsOverlay.css'

/** Slide-over wrapper so settings can be edited without leaving the new tab. */
export function SettingsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { reset } = useSettingsActions()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  return (
    <>
      <div className="overlay__scrim" data-open={open} onClick={onClose} aria-hidden={!open} />
      <div
        className="overlay"
        data-open={open}
        role="dialog"
        aria-label="Settings"
        aria-modal={open}
        tabIndex={-1}
        ref={panelRef}
      >
        {open ? (
          <SettingsPanel
            onClose={onClose}
            footer={
              <>
                {isExtension() ? (
                  <Button
                    icon="external"
                    variant="ghost"
                    onClick={() => chrome.runtime.openOptionsPage()}
                  >
                    Open full page
                  </Button>
                ) : null}
                <Button icon="reset" variant="ghost" onClick={() => void reset()}>
                  Reset all
                </Button>
              </>
            }
          />
        ) : null}
      </div>
    </>
  )
}
