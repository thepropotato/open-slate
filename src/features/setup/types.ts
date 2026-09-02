import type { ComponentType } from 'react'
import type { IconName } from '@/core/icons'

/**
 * A walkthrough hosted on `setup.html`.
 *
 * Guides exist for anything a user must configure outside the extension -
 * registering an API app, pasting a key - where a widget's own tile is too small
 * to explain the steps. Each owns its whole page body; the host supplies only
 * the chrome around it.
 */
export interface SetupGuide {
  /** Matched against `?guide=` in the URL. Stable: links to it are stored. */
  id: string
  /** Shown in the sidebar and the browser tab. */
  title: string
  /** One line under the title in the sidebar. */
  summary?: string
  icon: IconName
  Component: ComponentType
}
