import { DataPanel } from '../DataPanel'
import { SyncPanel } from '../SyncPanel'
import type { Section } from '../types'

export const dataSection: Section = {
  id: 'data',
  label: 'Backup',
  icon: 'archive',
  groups: [
    {
      id: 'sync',
      label: 'Sync',
      fields: [
        {
          label: 'Cross-device sync',
          control: { kind: 'custom', render: () => <SyncPanel />, bare: true },
          keywords: 'sync devices chrome profile push pull',
        },
      ],
    },
    {
      id: 'data',
      label: 'Backup',
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
