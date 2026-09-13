import type { ReactNode } from 'react'

// Surface and body, and nothing else: at rest a widget carries no chrome at
// all. Moving, resizing and configuring are arrange mode and the right-click
// menu, so the face stays live and uncovered.
export function WidgetFrame({
  surface,
  children,
}: {
  surface: 'glass' | 'solid' | 'outline' | 'none'
  children: ReactNode
}) {
  return (
    <div className="wframe">
      <div className="wframe__surface surface" data-scope={surface} />
      <div className="wframe__body">{children}</div>
    </div>
  )
}
