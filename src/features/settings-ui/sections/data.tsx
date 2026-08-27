import { DataPanel } from '../DataPanel'
import type { Section } from '../types'

export const dataSection: Section = {
  id: 'data',
  label: 'Backup',
  icon: 'archive',
  groups: [
    {
      id: 'data',
      fields: [
        {
          label: 'Backup and sharing',
          control: { kind: 'custom', render: () => <DataPanel />, bare: true },
          keywords: 'export import backup restore reset theme code share media storage',
        },
      ],
    },
  ],
}
