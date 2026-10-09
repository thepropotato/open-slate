import { useState } from 'react'
import { z } from 'zod'
import { useNow } from '@/core/hooks'
import { useSettings } from '@/core/settings/SettingsProvider'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { timeParts } from '@/core/util/time'
import './greeting.css'

interface Quote {
  text: string
  author: string
  category: 'wisdom' | 'craft' | 'stoic'
}

const QUOTES: Quote[] = [
  // Wisdom
  { text: 'Simplicity is prerequisite for reliability.', author: 'Edsger W. Dijkstra', category: 'wisdom' },
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain', category: 'wisdom' },
  { text: 'Make everything as simple as possible, but not simpler.', author: 'Albert Einstein', category: 'wisdom' },
  { text: 'Knowing others is intelligence; knowing yourself is true wisdom.', author: 'Lao Tzu', category: 'wisdom' },
  { text: 'It is not that we have a short time to live, but that we waste a lot of it.', author: 'Seneca', category: 'wisdom' },
  { text: 'Focus is about saying no to good ideas.', author: 'Steve Jobs', category: 'wisdom' },
  { text: 'The quieter you become, the more you are able to hear.', author: 'Rumi', category: 'wisdom' },
  { text: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein', category: 'wisdom' },
  { text: 'Do not seek to follow in the footsteps of the wise; seek what they sought.', author: 'Matsuo Bashō', category: 'wisdom' },
  { text: 'The mind is not a vessel to be filled, but a fire to be kindled.', author: 'Plutarch', category: 'wisdom' },

  // Craft & Building
  { text: 'Simple things should be simple, complex things should be possible.', author: 'Alan Kay', category: 'craft' },
  { text: 'Perfection is achieved when there is nothing left to take away.', author: 'Antoine de Saint-Exupéry', category: 'craft' },
  { text: 'Make it work, make it right, make it fast.', author: 'Kent Beck', category: 'craft' },
  { text: 'Details make perfection, and perfection is not a detail.', author: 'Leonardo da Vinci', category: 'craft' },
  { text: 'Design is how it works.', author: 'Steve Jobs', category: 'craft' },
  { text: 'The function of good software is to make the complex appear simple.', author: 'Grady Booch', category: 'craft' },
  { text: 'First, solve the problem. Then, write the code.', author: 'John Johnson', category: 'craft' },
  { text: 'Simplicity is about subtracting the obvious and adding the meaningful.', author: 'John Maeda', category: 'craft' },
  { text: 'There are two ways of constructing software: simple or complex. The first method is far more difficult.', author: 'C.A.R. Hoare', category: 'craft' },

  // Stoic
  { text: 'You have power over your mind, not outside events.', author: 'Marcus Aurelius', category: 'stoic' },
  { text: 'We suffer more often in imagination than in reality.', author: 'Seneca', category: 'stoic' },
  { text: 'Don’t explain your philosophy. Embody it.', author: 'Epictetus', category: 'stoic' },
  { text: 'Waste no more time arguing what a good person should be. Be one.', author: 'Marcus Aurelius', category: 'stoic' },
  { text: 'If you want to improve, be content to be thought foolish and stupid.', author: 'Epictetus', category: 'stoic' },
  { text: 'The impediment to action advances action. What stands in the way becomes the way.', author: 'Marcus Aurelius', category: 'stoic' },
  { text: 'No person has the power to have everything they want, but it is in their power not to want what they don’t have.', author: 'Seneca', category: 'stoic' },
  { text: 'How long are you going to wait before you demand the best for yourself?', author: 'Epictetus', category: 'stoic' },
]

const GreetingConfig = z.object({
  mode: z.enum(['greeting', 'quote', 'custom']).default('greeting'),
  /** Falls back to the global name in Behaviour settings. */
  name: z.string().default(''),
  tone: z.enum(['greeting', 'question', 'plain']).default('greeting'),
  quoteCategory: z.enum(['all', 'daily', 'wisdom', 'craft', 'stoic']).default('all'),
  quoteCadence: z.enum(['tab', 'hourly', 'daily']).default('tab'),
  customQuote: z.string().default(''),
  customAuthor: z.string().default(''),
  size: z.enum(['s', 'm', 'l']).default('m'),
  align: z.enum(['flex-start', 'center', 'flex-end']).default('center'),
})

type GreetingConfig = z.infer<typeof GreetingConfig>

function GreetingWidget({ config }: WidgetProps<GreetingConfig>) {
  const { behavior } = useSettings()
  const now = useNow('minute')
  const { hours24 } = timeParts(now, behavior.timezone || undefined)
  const name = (config.name || behavior.greetingName).trim()
  const [tabSeed] = useState(() => Math.floor(Math.random() * 1000))
  const [quoteOffset, setQuoteOffset] = useState(0)

  const textAlign =
    config.align === 'flex-start' ? 'left' : config.align === 'flex-end' ? 'right' : 'center'

  if (config.mode === 'custom') {
    const text = config.customQuote.trim() || 'Make it simple, but significant.'
    const author = config.customAuthor.trim()
    return (
      <div
        className="greeting greeting--quote"
        data-size={config.size}
        style={{ alignItems: config.align, textAlign }}
      >
        <p className="greeting__line">“{text}”</p>
        {author ? <p className="greeting__author">— {author}</p> : null}
      </div>
    )
  }

  if (config.mode === 'quote') {
    const pool =
      config.quoteCategory === 'all' || config.quoteCategory === 'daily'
        ? QUOTES
        : QUOTES.filter((q) => q.category === config.quoteCategory)
    const list = pool.length > 0 ? pool : QUOTES

    const baseIndex =
      config.quoteCadence === 'hourly'
        ? Math.floor(now.getTime() / (1000 * 60 * 60))
        : config.quoteCadence === 'daily'
          ? Math.floor(
              (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24),
            )
          : tabSeed

    const index = Math.abs(baseIndex + quoteOffset) % list.length
    const current = list[index] ?? QUOTES[0]

    return (
      <div
        className="greeting greeting--quote"
        data-size={config.size}
        style={{ alignItems: config.align, textAlign }}
        onClick={() => setQuoteOffset((o) => o + 1)}
        title="Click to cycle quote"
      >
        <p className="greeting__line">“{current.text}”</p>
        <p className="greeting__author">— {current.author}</p>
      </div>
    )
  }

  return (
    <div
      className="greeting"
      data-size={config.size}
      style={{ alignItems: config.align, textAlign }}
    >
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
  name: 'Greeting & Quote',
  description: 'A line that changes with the time of day, or inspirational quotes.',
  icon: 'star',
  configSchema: GreetingConfig,
  sizes: ['medium', 'wide', 'xlarge'],
  defaultSize: 'wide',
  Component: GreetingWidget,
  fields: [
    {
      path: 'mode',
      label: 'Mode',
      control: {
        kind: 'segmented',
        options: [
          { value: 'greeting', label: 'Greeting' },
          { value: 'quote', label: 'Quote' },
          { value: 'custom', label: 'Custom' },
        ],
      },
    },
    {
      path: 'name',
      label: 'Name',
      help: 'Overrides the name set under Behaviour.',
      control: { kind: 'text', placeholder: 'From Behaviour settings' },
    },
    {
      path: 'tone',
      label: 'Greeting tone',
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
      path: 'quoteCategory',
      label: 'Quote theme',
      control: {
        kind: 'segmented',
        options: [
          { value: 'all', label: 'All' },
          { value: 'wisdom', label: 'Wisdom' },
          { value: 'craft', label: 'Craft' },
          { value: 'stoic', label: 'Stoic' },
        ],
      },
    },
    {
      path: 'quoteCadence',
      label: 'Update cadence',
      control: {
        kind: 'segmented',
        options: [
          { value: 'tab', label: 'Every tab' },
          { value: 'hourly', label: 'Hourly' },
          { value: 'daily', label: 'Daily' },
        ],
      },
    },
    {
      path: 'customQuote',
      label: 'Custom quote',
      control: { kind: 'text', placeholder: 'Your custom quote' },
    },
    {
      path: 'customAuthor',
      label: 'Quote author',
      control: { kind: 'text', placeholder: 'Author name' },
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
