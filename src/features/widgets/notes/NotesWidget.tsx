import { z } from 'zod'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import './notes.css'

// Scratchpad. Text lives in the widget's config, so the ordinary debounced
// settings write saves it and it travels with an exported config.

const NotesConfig = z.object({
  text: z.string().default(''),
  placeholder: z.string().default('Notes'),
  font: z.enum(['sans', 'mono', 'serif']).default('sans'),
  scale: z.number().min(0.75).max(1.6).default(1),
  wrap: z.boolean().default(true),
})

type NotesConfig = z.infer<typeof NotesConfig>

function NotesWidget({ config, setConfig }: WidgetProps<NotesConfig>) {
  return (
    <textarea
      className="notes"
      data-font={config.font}
      style={{ fontSize: `calc(var(--text-sm) * ${config.scale})` }}
      value={config.text}
      placeholder={config.placeholder}
      onChange={(event) => setConfig({ text: event.target.value })}
      spellCheck
      wrap={config.wrap ? 'soft' : 'off'}
      aria-label="Notes"
    />
  )
}

registerWidget<NotesConfig>({
  type: 'notes',
  name: 'Notes',
  description: 'A scratchpad that saves as you type.',
  icon: 'notes',
  configSchema: NotesConfig,
  sizes: ['medium', 'large', 'xlarge'],
  defaultSize: 'large',
  Component: NotesWidget,
  fields: [
    {
      path: 'font',
      label: 'Font',
      control: {
        kind: 'segmented',
        options: [
          { value: 'sans', label: 'Sans' },
          { value: 'mono', label: 'Mono' },
          { value: 'serif', label: 'Serif' },
        ],
      },
    },
    {
      path: 'scale',
      label: 'Text size',
      control: { kind: 'slider', min: 0.75, max: 1.6, step: 0.05, format: (v) => `${Math.round(v * 100)}%` },
    },
    { path: 'wrap', label: 'Wrap lines', control: { kind: 'toggle' } },
    { path: 'placeholder', label: 'Placeholder', control: { kind: 'text' } },
  ],
})
