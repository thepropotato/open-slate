import { Suspense, useEffect, useRef } from 'react'
import { lazyChunk } from '@/core/util/lazyChunk'
import { Button } from '@/core/ui'
import { isExtension } from '@/core/platform/browser'
import './SettingsOverlay.css'

/**
 * Loaded on demand. The settings UI pulls in the whole spec and every control,
 * and a new tab must paint before any of that is needed.
 */
const SettingsPanel = lazyChunk(() =>
  import('./SettingsPanel').then((m) => ({ default: m.SettingsPanel })),
)

/**
 * Slide-over wrapper so settings can be edited without leaving the new tab.
 *
 * The footer deliberately holds nothing destructive: resetting lives in the
 * Backup section behind its own confirmation, rather than one click away from
 * the navigation.
 */
export function SettingsOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
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
          <Suspense fallback={<div className="overlay__loading" />}>
          <SettingsPanel
            onClose={onClose}
            footer={
              isExtension() ? (
                <Button icon="external" onClick={() => chrome.runtime.openOptionsPage()}>
                  Open full page
                </Button>
              ) : null
            }
          />
          </Suspense>
        ) : null}
      </div>
    </>
  )
}
