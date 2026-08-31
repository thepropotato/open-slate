import type { IconName } from '@/core/icons'
import { isExtension, openOptions } from '@/core/platform/browser'
import type { Settings } from '@/core/settings/schema'
import type { SettingsActions } from '@/core/settings/SettingsProvider'
import type { Suggestion } from '@/features/search/providers'

// Commands the palette can run, as data so one list feeds matching, keyboard
// navigation and the default view.

export interface PaletteAction {
  id: string
  title: string
  hint?: string
  icon: IconName
  keywords?: string
  run: () => void | Promise<void>
}

export function buildActions(settings: Settings, actions: SettingsActions): PaletteAction[] {
  const { update, set, reset } = actions

  const toggle = (path: string, current: boolean, title: string, icon: IconName): PaletteAction => ({
    id: `toggle:${path}`,
    title,
    hint: current ? 'On' : 'Off',
    icon,
    keywords: 'toggle switch',
    run: () => set(path, !current),
  })

  const list: PaletteAction[] = [
    {
      id: 'settings',
      title: 'Open settings',
      icon: 'settings',
      keywords: 'preferences options configure',
      run: () => openOptions(),
    },
    {
      id: 'theme:cycle',
      title: 'Switch light and dark',
      hint: settings.appearance.mode,
      icon: settings.appearance.mode === 'dark' ? 'light' : 'dark',
      keywords: 'theme appearance colour scheme',
      run: () =>
        set(
          'appearance.mode',
          settings.appearance.mode === 'auto'
            ? 'light'
            : settings.appearance.mode === 'light'
              ? 'dark'
              : 'auto',
        ),
    },
    {
      id: 'radius:boxy',
      title: settings.appearance.radius === 0 ? 'Round the corners' : 'Square the corners',
      icon: 'shape',
      keywords: 'radius rounded boxy shape corners',
      run: () => set('appearance.radius', settings.appearance.radius === 0 ? 16 : 0),
    },
    {
      id: 'widgets:arrange',
      title: settings.widgets.locked ? 'Rearrange widgets' : 'Lock the widget layout',
      icon: settings.widgets.locked ? 'unlock' : 'lock',
      keywords: 'move resize dashboard grid',
      run: () => set('widgets.locked', !settings.widgets.locked),
    },
    {
      id: 'pane:widgets',
      title: 'Show the widgets',
      icon: 'layers',
      keywords: 'dashboard tab pane switch',
      run: () => set('layout.lastPane', 'widgets'),
    },
    {
      id: 'pane:tiles',
      title: 'Show the tiles',
      icon: 'layout',
      keywords: 'speed dial shortcuts tab pane switch',
      run: () => set('layout.lastPane', 'tiles'),
    },
    {
      id: 'view:mode',
      title:
        settings.layout.viewMode === 'tabs'
          ? 'Put widgets and tiles on one page'
          : 'Split widgets and tiles into tabs',
      icon: 'tabs',
      keywords: 'view mode scroll tabs layout',
      run: () => set('layout.viewMode', settings.layout.viewMode === 'tabs' ? 'scroll' : 'tabs'),
    },
    toggle('tiles.enabled', settings.tiles.enabled, 'Show or hide the tiles', 'layers'),
    toggle('search.enabled', settings.search.enabled, 'Show or hide the search box', 'search'),
    toggle('widgets.enabled', settings.widgets.enabled, 'Show or hide the widgets', 'layout'),
    toggle('appearance.zenMode', settings.appearance.zenMode, 'Zen mode', 'hide'),
    toggle('appearance.animations', settings.appearance.animations, 'Animations', 'magic'),
    {
      id: 'wallpaper:next',
      title: 'Next palette',
      icon: 'palette',
      keywords: 'theme colour preset',
      run: () =>
        update((current) => ({
          ...current,
          appearance: { ...current.appearance, preset: nextPreset(current.appearance.preset) },
        })),
    },
    {
      id: 'reset',
      title: 'Reset everything to defaults',
      icon: 'reset',
      keywords: 'clear wipe start over',
      run: () => reset(),
    },
  ]

  if (isExtension()) {
    list.push({
      id: 'chrome:extensions',
      title: 'Open the extensions page',
      icon: 'brandChrome',
      keywords: 'manage install',
      run: () => window.location.assign('chrome://extensions'),
    })
    list.push({
      id: 'chrome:downloads',
      title: 'Open downloads',
      icon: 'download',
      keywords: 'files saved',
      run: () => window.location.assign('chrome://downloads'),
    })
    list.push({
      id: 'chrome:history',
      title: 'Open the history page',
      icon: 'history',
      keywords: 'visited',
      run: () => window.location.assign('chrome://history'),
    })
    list.push({
      id: 'chrome:bookmarks',
      title: 'Open the bookmark manager',
      icon: 'bookmark',
      keywords: 'saved favourites',
      run: () => window.location.assign('chrome://bookmarks'),
    })
  }

  return list
}

/** Presets are ordered, so "next" just walks the list. */
function nextPreset(current: string): string {
  const order = [
    'midnight',
    'graphite',
    'ocean',
    'nord',
    'ember',
    'forest',
    'violet',
    'paper',
  ]
  const index = order.indexOf(current)
  return order[(index + 1) % order.length]
}

// Scored on the same scale as the providers, so both can be ranked together.
export function matchAction(action: PaletteAction, needle: string): Suggestion | null {
  const haystack = `${action.title} ${action.keywords ?? ''}`.toLowerCase()
  if (needle && !haystack.includes(needle)) return null
  const score = !needle
    ? 40
    : action.title.toLowerCase().startsWith(needle)
      ? 120
      : action.title.toLowerCase().includes(needle)
        ? 90
        : 55
  return {
    id: `action:${action.id}`,
    kind: 'action',
    title: action.title,
    subtitle: action.hint,
    icon: action.icon,
    score,
    run: action.run,
  }
}
