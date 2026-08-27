import type { Section } from '../types'

export const widgetsSection: Section = {
  id: 'widgets',
  label: 'Widgets',
  icon: 'layout',
  groups: [
    {
      id: 'general',
      fields: [
        { path: 'widgets.enabled', label: 'Show widgets', control: { kind: 'toggle' } },
        {
          path: 'widgets.locked',
          label: 'Lock the layout',
          help: 'Unlock to drag and resize. Widgets stay interactive either way.',
          control: { kind: 'toggle' },
        },
      ],
    },
    {
      id: 'grid',
      label: 'Grid',
      when: (s) => s.widgets.enabled,
      fields: [
        {
          path: 'widgets.columns',
          label: 'Widgets across',
          help: 'How many small widgets fit in a row. Fewer means bigger widgets.',
          control: { kind: 'slider', min: 4, max: 10 },
        },
        {
          path: 'widgets.margin',
          label: 'Spacing',
          control: { kind: 'slider', min: 0, max: 48, unit: 'px' },
        },
        {
          path: 'widgets.compact',
          label: 'Compacting',
          help: 'Whether widgets fall towards an edge to close gaps.',
          control: {
            kind: 'segmented',
            options: [
              { value: 'none', label: 'Free' },
              { value: 'vertical', label: 'Up' },
              { value: 'horizontal', label: 'Left' },
            ],
          },
        },
      ],
    },
  ],
}
