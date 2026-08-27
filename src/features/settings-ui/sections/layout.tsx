import type { Section } from '../types'

export const layoutSection: Section = {
  id: 'layout',
  label: 'Layout',
  icon: 'layout',
  groups: [
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
