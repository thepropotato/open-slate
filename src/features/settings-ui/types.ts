import type { ReactNode } from 'react'
import type { Choice } from '@/core/ui'
import type { IconName } from '@/core/icons'
import type { Settings } from '@/core/settings/schema'
import type { FieldScope } from './FieldRenderer'

/**
 * Declarative description of the settings UI.
 *
 * A preference is declared exactly once here: the dot-path binds it to the zod
 * schema, and the control descriptor tells the renderer how to draw it. Adding
 * a new setting is therefore a schema line plus a spec line — never a new form
 * component.
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
      /** A slider whose value may be `null`, meaning "inherit from elsewhere". */
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
      /**
       * Receives the scope when the field is rendered against a local object —
       * a widget's own config — and nothing when it is a global setting. That is
       * what lets a widget ship a bespoke control over its own state.
       */
      render: (scope?: FieldScope) => ReactNode
      stacked?: boolean
      /** Renders the node with no surrounding label row, for panels with their own headings. */
      bare?: boolean
    }

export interface Field {
  /** Dot-path into `Settings`. Omitted only for `custom` controls. */
  path?: string
  label: string
  help?: string
  control: FieldControl
  /** Hides the field when the predicate is false — e.g. video-only options. */
  when?: (settings: Settings) => boolean
  /**
   * Same, but for a field rendered against a local object rather than global
   * settings — a widget's own config. Both predicates must pass.
   */
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
