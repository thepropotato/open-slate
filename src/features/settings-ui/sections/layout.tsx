import type { Section } from '../types'

export const layoutSection: Section = {
  id: 'layout',
  label: 'Layout',
  icon: 'layout',
  groups: [
    {
      id: 'view',
      label: 'View',
      fields: [
        {
          path: 'layout.viewMode',
          label: 'Widgets and tiles',
          help: 'One scrolling page, or two tabs behind a switch.',
          control: {
            kind: 'segmented',
            options: [
              { value: 'scroll', label: 'One page' },
              { value: 'tabs', label: 'Two tabs' },
            ],
          },
        },
        {
          path: 'layout.defaultPane',
          label: 'Open on',
          help: 'Which side a new tab starts on.',
          when: (s) => s.layout.viewMode === 'tabs',
          control: {
            kind: 'segmented',
            options: [
              { value: 'last', label: 'Last used' },
              { value: 'widgets', label: 'Widgets' },
              { value: 'tiles', label: 'Tiles' },
            ],
          },
        },
      ],
    },
    {
      id: 'page',
      label: 'Page',
      fields: [
        {
          path: 'layout.align',
          label: 'Vertical position',
          control: {
            kind: 'segmented',
            options: [
              { value: 'top', label: 'Top' },
              { value: 'center', label: 'Centre' },
              { value: 'bottom', label: 'Bottom' },
            ],
          },
        },
        {
          path: 'layout.maxWidth',
          label: 'Content width',
          control: { kind: 'slider', min: 600, max: 2400, step: 20, unit: 'px' },
        },
        {
          path: 'layout.paddingY',
          label: 'Vertical padding',
          control: { kind: 'slider', min: 0, max: 200, step: 4, unit: 'px' },
        },
        {
          path: 'layout.gap',
          label: 'Gap between bands',
          control: { kind: 'slider', min: 0, max: 120, step: 2, unit: 'px' },
        },
      ],
    },
  ],
}
