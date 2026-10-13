import { DataPanel } from '../DataPanel'
import { SnapshotList } from '../SnapshotList'
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
      id: 'history',
      label: 'Recent versions',
      help: 'Your settings as they were before each save, so a bad experiment can be undone.',
      fields: [
        {
          label: 'Restore an earlier version',
          control: { kind: 'custom', render: () => <SnapshotList />, bare: true },
          keywords: 'undo history snapshot restore previous version revert',
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
