import type { ReactNode } from 'react'
import type { Choice } from '@/core/ui'
import type { IconName } from '@/core/icons'
import type { Settings } from '@/core/settings/schema'
import type { FieldScope } from './FieldRenderer'

/**
 * Declarative description of the settings UI. A preference is declared once: the
 * dot-path binds it to the zod schema, the control descriptor draws it. Adding a
 * setting is a schema line plus a spec line, never a new form component.
 */

export type FieldControl =
  | { kind: 'toggle' }
  | {
      kind: 'slider'
      min: number
      max: number
      step?: number
      unit?: string
      format?: (value: number) => string
    }
  | {
      /** Value may be `null`, meaning "inherit from elsewhere". */
      kind: 'nullableSlider'
      min: number
      max: number
      step?: number
      unit?: string
      inheritLabel: string
      fallback: (settings: Settings) => number
    }
  | { kind: 'number'; min?: number; max?: number; step?: number }
  | { kind: 'segmented'; options: Choice[] }
  | { kind: 'select'; options: Choice[] }
  | { kind: 'color' }
  | { kind: 'text'; placeholder?: string; wide?: boolean }
  | {
      kind: 'custom'
      /** Receives the scope for a widget-local field; nothing for a global one. */
      render: (scope?: FieldScope) => ReactNode
      stacked?: boolean
      /** No surrounding label row, for panels with their own headings. */
      bare?: boolean
    }

export interface Field {
  /** Dot-path into `Settings`. Omitted only for `custom` controls. */
  path?: string
  label: string
  help?: string
  control: FieldControl
  /** Hides the field when the predicate is false - e.g. video-only options. */
  when?: (settings: Settings) => boolean
  /** Same, against a widget's own config. Both predicates must pass. */
  whenLocal?: (values: Record<string, unknown>) => boolean
  /** Extra words matched by the settings search box. */
  keywords?: string
}

export interface FieldGroup {
  id: string
  label?: string
  help?: string
  fields: Field[]
  when?: (settings: Settings) => boolean
}

export interface Section {
  id: string
  label: string
  icon: IconName
  groups: FieldGroup[]
}
