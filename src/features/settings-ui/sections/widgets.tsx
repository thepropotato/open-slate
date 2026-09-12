import { SlatePanel } from '../SlatePanel'
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
      id: 'slates',
      label: 'Layouts',
      when: (s) => s.widgets.enabled,
      fields: [
        {
          label: 'Slates',
          control: { kind: 'custom', render: () => <SlatePanel />, bare: true },
          keywords: 'slate layout preset template share gallery community arrangement starter',
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
