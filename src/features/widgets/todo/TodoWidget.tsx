import { useState } from 'react'
import { z } from 'zod'
import { Icon } from '@/core/icons'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { uid } from '@/core/util/id'
import './todo.css'

const TodoItem = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean().default(false),
})

const TodoConfig = z.object({
  items: z.array(TodoItem).default([]),
  /** Completed items drop to the bottom rather than vanishing. */
  hideDone: z.boolean().default(false),
  showCount: z.boolean().default(true),
  strikeDone: z.boolean().default(true),
})

type TodoConfig = z.infer<typeof TodoConfig>
type TodoItem = z.infer<typeof TodoItem>

function TodoWidget({ config, setConfig }: WidgetProps<TodoConfig>) {
  const [draft, setDraft] = useState('')

  const write = (items: TodoItem[]) => setConfig({ items })

  const add = () => {
    const text = draft.trim()
    if (!text) return
    write([...config.items, { id: uid('t'), text, done: false }])
    setDraft('')
  }

  const toggle = (id: string) =>
    write(config.items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)))

  const remove = (id: string) => write(config.items.filter((item) => item.id !== id))

  // Done items sink to the bottom, keeping the live list at eye level.
  const ordered = [...config.items].sort((a, b) => Number(a.done) - Number(b.done))
  const visible = config.hideDone ? ordered.filter((item) => !item.done) : ordered
  const remaining = config.items.filter((item) => !item.done).length

  return (
    <div className="todo">
      <form
        className="todo__add"
        onSubmit={(event) => {
          event.preventDefault()
          add()
        }}
      >
        <Icon name="add" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a task"
          aria-label="Add a task"
        />
        {config.showCount && config.items.length > 0 ? (
          <span className="todo__count">{remaining}</span>
        ) : null}
      </form>

      <ul className="todo__list scroll-y">
        {visible.map((item) => (
          <li key={item.id} data-done={item.done}>
            <button
              type="button"
              className="todo__check"
              onClick={() => toggle(item.id)}
              aria-pressed={item.done}
              aria-label={item.done ? `Mark ${item.text} as not done` : `Mark ${item.text} as done`}
            >
              {item.done ? <Icon name="check" /> : null}
            </button>
            <span className="todo__text" data-strike={config.strikeDone && item.done}>
              {item.text}
            </span>
            <button
              type="button"
              className="todo__remove"
              onClick={() => remove(item.id)}
              title="Remove"
              aria-label={`Remove ${item.text}`}
            >
              <Icon name="close" />
            </button>
          </li>
        ))}
      </ul>

      {config.items.length === 0 ? <p className="todo__empty">Nothing on the list.</p> : null}
    </div>
  )
}

registerWidget<TodoConfig>({
  type: 'todo',
  name: 'Tasks',
  description: 'A short list of what needs doing.',
  icon: 'todo',
  configSchema: TodoConfig,
  defaultSize: { w: 6, h: 5 },
  minSize: { w: 3, h: 3 },
  Component: TodoWidget,
  fields: [
    { path: 'hideDone', label: 'Hide completed', control: { kind: 'toggle' } },
    { path: 'strikeDone', label: 'Strike through completed', control: { kind: 'toggle' } },
    { path: 'showCount', label: 'Show remaining count', control: { kind: 'toggle' } },
  ],
})
