import { useMemo, useState } from 'react'
import { z } from 'zod'
import { Icon } from '@/core/icons'
import { useNow } from '@/core/hooks'
import { useSettings } from '@/core/settings/SettingsProvider'
import { registerWidget } from '@/core/widgets/registry'
import type { WidgetProps } from '@/core/widgets/types'
import { uid } from '@/core/util/id'
import { resolveLocale } from '@/core/util/time'
import {
  PRIORITY_LABELS,
  PRIORITY_SHORT,
  addDays,
  dueLabel,
  parseDraft,
  sortItems,
  startOfDay,
  type Priority,
} from './parse'
import './todo.css'

/**
 * A task list that grows up only when asked to.
 *
 * Priorities and due dates are both off by default, and with them off this is
 * the same list it has always been: a line of text and a checkbox. Turning them
 * on must not turn adding a task into filling in a form, so the cost of setting
 * one is kept to typing — `!` for priority, `@ friday` for a date, read out of
 * the line as it is typed (see `parse.ts`) and echoed back as chips under the
 * field so nothing is set invisibly. The per-row controls exist for tasks
 * already on the list, and appear on hover rather than taking permanent space.
 */

const TodoItem = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean().default(false),
  /** 0 is unset, 1 the most urgent. Ignored while `priorities` is off. */
  priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(0),
  /** Epoch ms of local midnight, or 0 for no date. */
  due: z.number().default(0),
  /** Epoch ms the task was completed, for the "clear done" sweep. */
  doneAt: z.number().default(0),
})

const TodoConfig = z.object({
  items: z.array(TodoItem).default([]),
  /** Completed items drop to the bottom rather than vanishing. */
  hideDone: z.boolean().default(false),
  showCount: z.boolean().default(true),
  strikeDone: z.boolean().default(true),

  /*
   * Priorities and due dates are the widget, not an upsell — a task list that
   * hides them behind a settings tab is one nobody discovers. They are still
   * toggles so a list that only wants checkboxes can say so, but they default
   * on, and cost nothing until a task actually carries one.
   */
  priorities: z.boolean().default(true),
  dueDates: z.boolean().default(true),
  /** `manual` keeps the order tasks were added in. */
  sortBy: z.enum(['manual', 'priority', 'due']).default('manual'),
  /** Overdue and due-today tasks carry a colour of their own. */
  flagOverdue: z.boolean().default(true),
})

type TodoConfig = z.infer<typeof TodoConfig>
type TodoItem = z.infer<typeof TodoItem>

const PRIORITIES: Priority[] = [1, 2, 3]

function TodoWidget({ config, setConfig, size }: WidgetProps<TodoConfig>) {
  const { behavior } = useSettings()
  const locale = resolveLocale(behavior.locale)
  // Minute precision: a date row that says "Today" has to stop saying it at
  // midnight, and overdue styling has to arrive on its own.
  const today = startOfDay(useNow('minute'))
  const [draft, setDraft] = useState('')
  /** Which row has its detail controls pinned open, if any. */
  const [editing, setEditing] = useState<string | null>(null)

  const rich = config.priorities || config.dueDates
  const write = (items: TodoItem[]) => setConfig({ items })
  const patch = (id: string, changes: Partial<TodoItem>) =>
    write(config.items.map((item) => (item.id === id ? { ...item, ...changes } : item)))

  // Parsed live so the field can show what it is about to record.
  const preview = useMemo(
    () =>
      parseDraft(draft, today, { priorities: config.priorities, dueDates: config.dueDates }),
    [draft, today, config.priorities, config.dueDates],
  )

  const add = () => {
    if (!preview.text) return
    write([
      ...config.items,
      {
        id: uid('t'),
        text: preview.text,
        done: false,
        priority: preview.priority,
        due: preview.due,
        doneAt: 0,
      },
    ])
    setDraft('')
  }

  const toggle = (id: string) =>
    write(
      config.items.map((item) =>
        item.id === id
          ? { ...item, done: !item.done, doneAt: item.done ? 0 : Date.now() }
          : item,
      ),
    )

  const remove = (id: string) => write(config.items.filter((item) => item.id !== id))

  const ordered = useMemo(() => sortItems(config.items, config.sortBy), [config.items, config.sortBy])
  const visible = config.hideDone ? ordered.filter((item) => !item.done) : ordered
  const remaining = config.items.filter((item) => !item.done).length
  // A one-row widget has no room for a second line under a task.
  const compact = size.h < 2

  return (
    <div className="todo" data-rich={rich}>
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
          placeholder={rich ? 'Add a task, ! or @ friday' : 'Add a task'}
          aria-label="Add a task"
        />
        {config.showCount && config.items.length > 0 ? (
          <span className="todo__count">{remaining}</span>
        ) : null}
      </form>

      {/*
        What the shorthand caught, shown only once it has caught something. It is
        the acknowledgement that makes typing `!` trustworthy — you can see the
        priority land before you press Enter.
      */}
      {draft.trim() && (preview.priority > 0 || preview.due > 0) ? (
        <p className="todo__preview">
          {preview.priority > 0 ? (
            <span className="todo__chip" data-priority={preview.priority}>
              {PRIORITY_SHORT[preview.priority]}
            </span>
          ) : null}
          {preview.due > 0 ? (
            <span className="todo__chip">
              <Icon name="calendar" /> {dueLabel(preview.due, today, locale)}
            </span>
          ) : null}
        </p>
      ) : null}

      <ul className="todo__list scroll-y">
        {visible.map((item) => {
          const overdue = config.dueDates && item.due > 0 && !item.done && item.due < today
          const dueToday = config.dueDates && item.due > 0 && !item.done && item.due === today
          const open = editing === item.id
          return (
            <li key={item.id} data-done={item.done} data-open={open}>
              {/*
                The checkbox belongs to the title, so the two sit on one line and
                the metadata hangs below it — a box vertically centred against a
                two-line block reads as belonging to neither line.
              */}
              <div className="todo__row">
                <button
                  type="button"
                  className="todo__check"
                  onClick={() => toggle(item.id)}
                  aria-pressed={item.done}
                  aria-label={
                    item.done ? `Mark ${item.text} as not done` : `Mark ${item.text} as done`
                  }
                >
                  {item.done ? <Icon name="check" /> : null}
                </button>

                <span className="todo__body">
                  <span className="todo__text" data-strike={config.strikeDone && item.done}>
                    {item.text}
                  </span>
                  {!compact && rich && (item.due > 0 || item.priority > 0) ? (
                    <span className="todo__meta">
                      {config.priorities && item.priority > 0 ? (
                        <span className="todo__chip" data-priority={item.priority}>
                          {PRIORITY_SHORT[item.priority]}
                        </span>
                      ) : null}
                      {config.dueDates && item.due > 0 ? (
                        <span
                          className="todo__due"
                          data-state={
                            config.flagOverdue && overdue
                              ? 'overdue'
                              : config.flagOverdue && dueToday
                                ? 'today'
                                : 'plain'
                          }
                        >
                          <Icon name="calendar" />
                          {dueLabel(item.due, today, locale)}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </span>

                {rich ? (
                  <button
                    type="button"
                    className="todo__icon todo__more"
                    onClick={() => setEditing(open ? null : item.id)}
                    aria-expanded={open}
                    aria-label={`Edit details for ${item.text}`}
                  >
                    <Icon name="sliders" />
                  </button>
                ) : null}

                <button
                  type="button"
                  className="todo__icon todo__remove"
                  onClick={() => remove(item.id)}
                  title="Remove"
                  aria-label={`Remove ${item.text}`}
                >
                  <Icon name="close" />
                </button>
              </div>

              {/*
                Only ever drawn for the one row being edited, so the list stays a
                list. Everything here is reachable by typing instead.
              */}
              {open ? (
                <div className="todo__detail">
                  {config.priorities ? (
                    <div className="todo__group" role="group" aria-label="Priority">
                      {PRIORITIES.map((level) => (
                        <button
                          key={level}
                          type="button"
                          className="todo__btn"
                          data-priority={level}
                          aria-pressed={item.priority === level}
                          title={PRIORITY_LABELS[level]}
                          onClick={() =>
                            patch(item.id, { priority: item.priority === level ? 0 : level })
                          }
                        >
                          {PRIORITY_SHORT[level]}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {config.dueDates ? (
                    <div className="todo__group">
                      <button
                        type="button"
                        className="todo__btn"
                        aria-pressed={item.due === today}
                        onClick={() => patch(item.id, { due: item.due === today ? 0 : today })}
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        className="todo__btn"
                        aria-pressed={item.due === addDays(today, 1)}
                        onClick={() =>
                          patch(item.id, {
                            due: item.due === addDays(today, 1) ? 0 : addDays(today, 1),
                          })
                        }
                      >
                        Tomorrow
                      </button>
                      <label className="todo__btn todo__date">
                        <Icon name="calendar" />
                        <input
                          type="date"
                          aria-label={`Due date for ${item.text}`}
                          value={item.due > 0 ? isoDate(item.due) : ''}
                          onChange={(event) =>
                            patch(item.id, { due: fromIsoDate(event.target.value) })
                          }
                        />
                      </label>
                      {item.due > 0 ? (
                        <button
                          type="button"
                          className="todo__btn todo__btn--icon"
                          onClick={() => patch(item.id, { due: 0 })}
                          title="Clear due date"
                          aria-label={`Clear due date for ${item.text}`}
                        >
                          <Icon name="close" />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      {config.items.length === 0 ? <p className="todo__empty">Nothing on the list.</p> : null}
    </div>
  )
}

/** `<input type="date">` speaks ISO in local terms; both helpers stay local. */
const isoDate = (ms: number): string => {
  const date = new Date(ms)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const fromIsoDate = (value: string): number => {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return 0
  return new Date(year, month - 1, day).getTime()
}

registerWidget<TodoConfig>({
  type: 'todo',
  name: 'Tasks',
  description: 'A short list of what needs doing.',
  icon: 'todo',
  configSchema: TodoConfig,
  sizes: ['medium', 'large', 'xlarge'],
  defaultSize: 'large',
  Component: TodoWidget,
  fields: [
    {
      path: 'priorities',
      label: 'Priorities',
      help: 'Type ! for high, !! medium, !!! low.',
      control: { kind: 'toggle' },
    },
    {
      path: 'dueDates',
      label: 'Due dates',
      help: 'Type @ today, @ friday, @ 3d or @ 25/12.',
      control: { kind: 'toggle' },
    },
    {
      path: 'flagOverdue',
      label: 'Highlight overdue',
      whenLocal: (values) => Boolean(values.dueDates),
      control: { kind: 'toggle' },
    },
    {
      path: 'sortBy',
      label: 'Sort by',
      control: {
        kind: 'segmented',
        options: [
          { value: 'manual', label: 'Added' },
          { value: 'priority', label: 'Priority' },
          { value: 'due', label: 'Due' },
        ],
      },
    },
    { path: 'hideDone', label: 'Hide completed', control: { kind: 'toggle' } },
    { path: 'strikeDone', label: 'Strike through completed', control: { kind: 'toggle' } },
    { path: 'showCount', label: 'Show remaining count', control: { kind: 'toggle' } },
  ],
})
