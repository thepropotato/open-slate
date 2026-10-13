import type { IconName } from '@/core/icons'
import { triggerAdd } from '@/core/events'
import { isExtension, openOptions } from '@/core/platform/browser'
import type { Settings } from '@/core/settings/schema'
import type { SettingsActions } from '@/core/settings/SettingsProvider'
import type { Suggestion } from '@/features/search/providers'
import { advanceNow, slideCount } from '@/features/background/advance'
import type { Scene } from '@/core/settings/scenes'
import { applySlate } from '@/core/settings/slateCode'
import { getWidget } from '@/core/widgets/registry'
import { uid } from '@/core/util/id'

// Commands the palette can run, as data so one list feeds matching, keyboard
// navigation and the default view.

export interface PaletteAction {
  id: string
  title: string
  hint?: string
  icon: IconName
  keywords?: string
  /** Shown on the right of the row. */
  shortcut?: string
  /** Offered in the default view; everything is searchable by typing. */
  common?: boolean
  run: () => void | Promise<void>
}

const MOD = /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd+' : 'Ctrl+'

export function buildActions(
  settings: Settings,
  actions: SettingsActions,
  /** Opens settings in place; falls back to the options page when absent. */
  onOpenSettings?: () => void,
  onArrange?: () => void,
  scenes: Scene[] = [],
): PaletteAction[] {
  const { update, set, reset } = actions

  // The title says what happens next, so a row never needs an "On" beside it.
  const toggle = (path: string, current: boolean, noun: string, icon: IconName, verbs = ['Hide', 'Show']): PaletteAction => ({
    id: `toggle:${path}`,
    title: `${current ? verbs[0] : verbs[1]} ${noun}`,
    icon,
    keywords: `toggle switch ${noun}`,
    run: () => set(path, !current),
  })

  // Switching panes only means something when the page is split into tabs.
  const paneActions: PaletteAction[] =
    settings.layout.viewMode === 'tabs'
      ? [
    {
          id: 'pane:widgets',
          title: 'Show the widgets pane',
          icon: 'layers',
          keywords: 'dashboard tab pane switch',
          run: () => set('layout.lastPane', 'widgets'),
        },
        {
          id: 'pane:tiles',
          title: 'Show the tiles pane',
          icon: 'layout',
          keywords: 'speed dial shortcuts tab pane switch',
          run: () => set('layout.lastPane', 'tiles'),
        },
      ]
      : []

  const sceneActions: PaletteAction[] = scenes.map((scene) => ({
    id: `scene:${scene.id}`,
    title: `Switch to ${scene.name}`,
    icon: 'layout',
    keywords: `scene layout ${scene.name}`,
    run: () => update((current) => applySlate(current, scene.code, uid, (type) => getWidget(type) !== undefined)),
  }))

  const list: PaletteAction[] = [
    ...sceneActions,
    ...(onArrange
      ? [
          {
            id: 'arrange:toggle',
            title: 'Arrange the page',
            icon: 'drag' as const,
            keywords: 'arrange layout widgets tiles move reorder edit customize',
            shortcut: 'E',
            common: true,
            run: onArrange,
          },
        ]
      : []),
    {
      id: 'settings',
      title: 'Open settings',
      icon: 'settings',
      keywords: 'preferences options configure customise customize',
      shortcut: `${MOD},`,
      common: true,
      run: () => (onOpenSettings ? onOpenSettings() : openOptions()),
    },
    {
      id: 'add:tile',
      title: 'Add a tile',
      icon: 'add',
      keywords: 'new site shortcut link bookmark',
      common: true,
      run: () => triggerAdd('tile'),
    },
    {
      id: 'add:widget',
      title: 'Add a widget',
      icon: 'layers',
      keywords: 'new clock weather notes tasks',
      common: true,
      run: () => triggerAdd('widget'),
    },
    {
      id: 'add:folder',
      title: 'Add a folder',
      icon: 'folder',
      keywords: 'new group tiles',
      run: () => triggerAdd('folder'),
    },
    {
      id: 'theme:cycle',
      title: 'Switch light and dark',
      hint: settings.appearance.mode,
      common: true,
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
    ...paneActions,
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
    toggle('tiles.enabled', settings.tiles.enabled, 'the tiles', 'layers'),
    toggle('search.enabled', settings.search.enabled, 'the search box', 'search'),
    toggle('widgets.enabled', settings.widgets.enabled, 'the widgets', 'layout'),
    toggle('appearance.zenMode', settings.appearance.zenMode, 'zen mode', 'hide', ['Turn off', 'Turn on']),
    toggle('appearance.animations', settings.appearance.animations, 'animations', 'magic', ['Turn off', 'Turn on']),
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

  // Only worth offering when there is more than one picture to move between.
  if (settings.background.type === 'slideshow' && slideCount(settings) > 1) {
    list.splice(-1, 0, {
      id: 'wallpaper:shuffle',
      title: 'Next wallpaper',
      icon: 'image',
      keywords: 'slideshow shuffle change picture background skip next',
      run: () => advanceNow(settings),
    })
  }

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
    shortcut: action.shortcut,
    score,
    run: action.run,
  }
}
