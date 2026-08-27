import { commonTimezones } from '@/core/util/time'
import type { Section } from '../types'

export const behaviorSection: Section = {
  id: 'behavior',
  label: 'Behaviour',
  icon: 'sliders',
  groups: [
    {
      id: 'you',
      label: 'You',
      fields: [
        {
          path: 'behavior.greetingName',
          label: 'Name',
          help: 'Used by the greeting widget.',
          control: { kind: 'text', placeholder: 'Optional' },
        },
        {
          path: 'behavior.locale',
          label: 'Locale',
          help: 'Formats dates and times. Empty follows the browser.',
          control: { kind: 'text', placeholder: 'Browser default' },
        },
        {
          path: 'behavior.timezone',
          label: 'Timezone',
          help: 'Applies to every time-based widget unless a widget overrides it.',
          control: {
            kind: 'select',
            options: [
              { value: '', label: 'Browser default' },
              ...commonTimezones().map((zone) => ({ value: zone, label: zone.replace(/_/g, ' ') })),
            ],
          },
        },
      ],
    },
    {
      id: 'keyboard',
      label: 'Keyboard',
      fields: [
        {
          path: 'behavior.commandPalette',
          label: 'Command palette',
          help: 'Cmd or Ctrl + K searches tabs, bookmarks, history and tiles.',
          control: { kind: 'toggle' },
        },
        {
          path: 'behavior.tileNumberShortcuts',
          label: 'Tile shortcuts',
          help: 'Hold Alt to reveal numbers, then Alt+1 to Alt+9 to open a tile.',
          control: { kind: 'toggle' },
        },
      ],
    },
    {
      id: 'safety',
      label: 'Safety',
      fields: [
        {
          path: 'behavior.confirmDelete',
          label: 'Confirm deletions',
          help: 'Ask before removing a tile or widget.',
          control: { kind: 'toggle' },
        },
      ],
    },
  ],
}
