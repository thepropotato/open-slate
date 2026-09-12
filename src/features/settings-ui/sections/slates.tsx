import { SlatePanel } from '../SlatePanel'
import type { Section } from '../types'

/**
 * Slates get a section rather than a group inside another one, because a slate
 * is not a widget setting. It carries the widget grid *and* the page layout
 * around it - band order, alignment, width, padding, view mode - so filing it
 * under either would put half of what it does somewhere the reader is not
 * looking.
 *
 * Named for the thing rather than "Layouts", which would sit directly under
 * "Layout" in the sidebar and read as a plural of it.
 */
export const slatesSection: Section = {
  id: 'slates',
  label: 'Slates',
  icon: 'magic',
  groups: [
    {
      id: 'slates',
      fields: [
        {
          label: 'Slates',
          control: { kind: 'custom', render: () => <SlatePanel />, bare: true },
          keywords:
            'slate layout preset template share gallery community marketplace arrangement starter browse',
        },
      ],
    },
  ],
}
