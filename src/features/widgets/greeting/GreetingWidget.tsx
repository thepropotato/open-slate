import { z } from 'zod'
import { useNow } from '@/core/hooks'
import { useSettings } from '@/core/settings/SettingsProvider'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { timeParts } from '@/core/util/time'
import './greeting.css'

const GreetingConfig = z.object({
  /** Falls back to the global name in Behaviour settings. */
  name: z.string().default(''),
  tone: z.enum(['greeting', 'question', 'plain']).default('greeting'),
  size: z.enum(['s', 'm', 'l']).default('m'),
  align: z.enum(['flex-start', 'center', 'flex-end']).default('center'),
})

type GreetingConfig = z.infer<typeof GreetingConfig>

function GreetingWidget({ config }: WidgetProps<GreetingConfig>) {
  const { behavior } = useSettings()
  const now = useNow('minute')
  const { hours24 } = timeParts(now, behavior.timezone || undefined)
  const name = (config.name || behavior.greetingName).trim()

  return (
    <div className="greeting" data-size={config.size} style={{ alignItems: config.align }}>
      <p className="greeting__line">{line(config.tone, hours24, name)}</p>
    </div>
  )
}

function line(tone: GreetingConfig['tone'], hour: number, name: string): string {
  const suffix = name ? `, ${name}` : ''
  if (tone === 'question') {
    return name ? `What's next, ${name}?` : "What's next?"
  }
  if (tone === 'plain') {
    return name ? name : partOfDay(hour)
  }
  return `Good ${partOfDay(hour)}${suffix}`
}

function partOfDay(hour: number): string {
  if (hour < 5) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  if (hour < 22) return 'evening'
  return 'night'
}

registerWidget<GreetingConfig>({
  type: 'greeting',
  name: 'Greeting',
  description: 'A line that changes with the time of day.',
  icon: 'star',
  configSchema: GreetingConfig,
  sizes: ['medium', 'wide', 'xlarge'],
  defaultSize: 'wide',
  Component: GreetingWidget,
  fields: [
    {
      path: 'name',
      label: 'Name',
      help: 'Overrides the name set under Behaviour.',
      control: { kind: 'text', placeholder: 'From Behaviour settings' },
    },
    {
      path: 'tone',
      label: 'Wording',
      control: {
        kind: 'segmented',
        options: [
          { value: 'greeting', label: 'Good morning' },
          { value: 'question', label: "What's next" },
          { value: 'plain', label: 'Plain' },
        ],
      },
    },
    {
      path: 'size',
      label: 'Size',
      control: {
        kind: 'segmented',
        options: [
          { value: 's', label: 'Small' },
          { value: 'm', label: 'Medium' },
          { value: 'l', label: 'Large' },
        ],
      },
    },
    {
      path: 'align',
      label: 'Alignment',
      control: {
        kind: 'segmented',
        options: [
          { value: 'flex-start', label: 'Left' },
          { value: 'center', label: 'Centre' },
          { value: 'flex-end', label: 'Right' },
        ],
      },
    },
  ],
})
