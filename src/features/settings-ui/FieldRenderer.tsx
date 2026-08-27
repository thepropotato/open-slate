import { useSettings, useSettingsActions } from '@/core/settings/SettingsProvider'
import { getPath } from '@/core/util/path'
import {
  ColorInput,
  NumberInput,
  Row,
  Segmented,
  Select,
  Slider,
  TextInput,
  Toggle,
} from '@/core/ui'
import type { Field } from './types'

/** Draws one declared field by dispatching on its control descriptor. */
export function FieldRenderer({ field }: { field: Field }) {
  const settings = useSettings()
  const { set } = useSettingsActions()

  if (field.when && !field.when(settings)) return null

  const control = field.control
  const value = field.path ? getPath(settings, field.path) : undefined
  const write = (next: unknown) => field.path && set(field.path, next)

  if (control.kind === 'custom') {
    return (
      <Row title={field.label} help={field.help} stacked={control.stacked}>
        {control.render()}
      </Row>
    )
  }

  return (
    <Row title={field.label} help={field.help} stacked={control.kind === 'text' && control.wide}>
      {control.kind === 'toggle' ? (
        <Toggle value={Boolean(value)} onChange={write} label={field.label} />
      ) : null}

      {control.kind === 'slider' ? (
        <Slider
          value={Number(value)}
          onChange={write}
          min={control.min}
          max={control.max}
          step={control.step}
          unit={control.unit}
          format={control.format}
        />
      ) : null}

      {control.kind === 'nullableSlider' ? (
        <>
          <button
            type="button"
            className="ctl-btn ctl-btn--ghost"
            onClick={() => write(value === null ? control.fallback(settings) : null)}
            title={control.inheritLabel}
            style={{ fontSize: 'var(--text-xs)', opacity: value === null ? 1 : 0.55 }}
          >
            {control.inheritLabel}
          </button>
          {value !== null ? (
            <Slider
              value={Number(value)}
              onChange={write}
              min={control.min}
              max={control.max}
              step={control.step}
              unit={control.unit}
            />
          ) : null}
        </>
      ) : null}

      {control.kind === 'number' ? (
        <NumberInput
          value={Number(value)}
          onChange={write}
          min={control.min}
          max={control.max}
          step={control.step}
        />
      ) : null}

      {control.kind === 'segmented' ? (
        <Segmented value={String(value)} onChange={write} options={control.options} />
      ) : null}

      {control.kind === 'select' ? (
        <Select value={String(value)} onChange={write} options={control.options} />
      ) : null}

      {control.kind === 'color' ? <ColorInput value={String(value)} onChange={write} /> : null}

      {control.kind === 'text' ? (
        <TextInput
          value={String(value ?? '')}
          onChange={write}
          placeholder={control.placeholder}
          wide={control.wide}
        />
      ) : null}
    </Row>
  )
}
