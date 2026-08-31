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
  DUE_LABELS,
  EMPTY_FILTER,
  PRIORITY_LABELS,
  PRIORITY_SHORT,
  STATUS_LABELS,
  activeFacetCount,
  addDays,
  dueLabel,
  parseDraft,
  isFilterEmpty,
  matchesFilter,
  sortItems,
  startOfDay,
  toggleFacet,
  type DueBucket,
  type Priority,
  type Status,
  type TaskFilter,
} from './parse'
import './todo.css'

// Task list. Priority and due dates are set by typing shorthand (see parse.ts)
// rather than a form; per-row controls appear on hover.

const TodoItem = z.object({
  id: z.string(),
  text: z.string(),
  done: z.boolean().default(false),
  /** 0 is unset, 1 the most urgent. Ignored while `priorities` is off. */
  priority: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]).default(0),
  /** Epoch ms of local midnight, or 0 for no date. */
  due: z.number().default(0),
  /** Epoch ms of completion, for the "clear done" sweep. */
  doneAt: z.number().default(0),
})

const TodoConfig = z.object({
  items: z.array(TodoItem).default([]),
  hideDone: z.boolean().default(false),
  showCount: z.boolean().default(true),
  strikeDone: z.boolean().default(true),

  priorities: z.boolean().default(true),
  dueDates: z.boolean().default(true),
  sortBy: z.enum(['manual', 'priority', 'due']).default('manual'),
  flagOverdue: z.boolean().default(true),
})

type TodoConfig = z.infer<typeof TodoConfig>
type TodoItem = z.infer<typeof TodoItem>

const PRIORITIES: Priority[] = [1, 2, 3]

const STATUSES: Status[] = ['active', 'done']
const BUCKETS: DueBucket[] = ['overdue', 'today', 'week', 'later', 'none']
// 0 last: "no priority" reads after the real priorities.
const PRIORITY_FACETS: Priority[] = [1, 2, 3, 0]

function TodoWidget({ config, setConfig, size }: WidgetProps<TodoConfig>) {
  const { behavior } = useSettings()
  const locale = resolveLocale(behavior.locale)
  // Minute precision so "Today" and overdue styling flip at midnight on their own.
  const today = startOfDay(useNow('minute'))
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  // Deliberately not persisted: reopening to a silently filtered list is worse.
  const [filter, setFilter] = useState<TaskFilter>(EMPTY_FILTER)
  const [panel, setPanel] = useState(false)

  const rich = config.priorities || config.dueDates
  const write = (items: TodoItem[]) => setConfig({ items })
  const patch = (id: string, changes: Partial<TodoItem>) =>
    write(config.items.map((item) => (item.id === id ? { ...item, ...changes } : item)))

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
  const matching = useMemo(
    () => ordered.filter((item) => matchesFilter(item, filter, today)),
    [ordered, filter, today],
  )
  // An explicit "done" filter overrides the standing `hideDone` preference.
  const visible =
    config.hideDone && !filter.status.includes('done')
      ? matching.filter((item) => !item.done)
      : matching
  const remaining = config.items.filter((item) => !item.done).length
  const compact = size.h < 2

  return (
    <div className="todo" data-rich={rich}>
      <div className="todo__bar">
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
            placeholder={rich ? 'Add a task, ! or @ date' : 'Add a task'}
            aria-label="Add a task"
          />
          {config.showCount && config.items.length > 0 ? (
            <span className="todo__count">{remaining}</span>
          ) : null}
        </form>

        {rich && config.items.length > 0 ? (
          <button
            type="button"
            className="todo__filter-btn is-icon-btn"
            data-on={!isFilterEmpty(filter)}
            onClick={() => setPanel((open) => !open)}
            aria-expanded={panel}
            aria-label={
              isFilterEmpty(filter)
                ? 'Filter tasks'
                : `Filter tasks, ${activeFacetCount(filter)} facets active`
            }
            title="Filter tasks"
          >
            <Icon name="filter" />
          </button>
        ) : null}
      </div>

      {/* Panel and list share one scroll area; a nested scroller is unusable here. */}
      <div className="todo__scroll scroll-y">
        {panel ? (
          <FilterPanel
            filter={filter}
            setFilter={setFilter}
            priorities={config.priorities}
            dueDates={config.dueDates}
            shown={visible.length}
            total={config.items.length}
            onClose={() => setPanel(false)}
          />
        ) : null}

      {/* Echoes what the shorthand caught, so nothing is set invisibly. */}
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

        <ul className="todo__list">
          {visible.map((item) => {
            const overdue = config.dueDates && item.due > 0 && !item.done && item.due < today
            const dueToday = config.dueDates && item.due > 0 && !item.done && item.due === today
            const open = editing === item.id
            return (
              <li key={item.id} data-done={item.done} data-open={open}>
                <div className="todo__row">
                  <button
                    type="button"
                    className="todo__check is-icon-btn"
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
                      className="todo__icon todo__more is-icon-btn"
                      onClick={() => setEditing(open ? null : item.id)}
                      aria-expanded={open}
                      aria-label={`Edit details for ${item.text}`}
                    >
                      <Icon name="sliders" />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="todo__icon todo__remove is-icon-btn"
                    onClick={() => remove(item.id)}
                    title="Remove"
                    aria-label={`Remove ${item.text}`}
                  >
                    <Icon name="close" />
                  </button>
                </div>

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
                            className="todo__btn todo__btn--icon is-icon-btn"
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

        {visible.length === 0 ? (
          <p className="todo__empty">
            {config.items.length === 0 ? (
              'Nothing on the list.'
            ) : (
              <>
                No tasks match.{' '}
                <button type="button" className="todo__link" onClick={() => setFilter(EMPTY_FILTER)}>
                  Clear filters
                </button>
              </>
            )}
          </p>
        ) : null}
      </div>
    </div>
  )
}

// Independent checkboxes per facet: more boxes in one facet widens, boxes in
// more facets narrows.
function FilterPanel({
  filter,
  setFilter,
  priorities,
  dueDates,
  shown,
  total,
  onClose,
}: {
  filter: TaskFilter
  setFilter: (next: TaskFilter) => void
  priorities: boolean
  dueDates: boolean
  shown: number
  total: number
  onClose: () => void
}) {
  const box = <T,>(facet: 'status' | 'priority' | 'due', values: readonly T[], value: T) => ({
    'aria-pressed': values.includes(value),
    onClick: () => setFilter({ ...filter, [facet]: toggleFacet(values, value) }),
  })

  return (
    <div className="todo__panel">
      <div className="todo__panel-head">
        <input
          className="todo__search"
          value={filter.text}
          onChange={(event) => setFilter({ ...filter, text: event.target.value })}
          placeholder="Search tasks"
          aria-label="Search tasks"
          autoFocus
        />
        <button
          type="button"
          className="todo__btn todo__btn--icon is-icon-btn"
          onClick={onClose}
          title="Close filters"
          aria-label="Close filters"
        >
          <Icon name="close" />
        </button>
      </div>

      <div className="todo__facet">
        <span className="todo__facet-label">Status</span>
        <div className="todo__group">
          {STATUSES.map((value) => (
            <button key={value} type="button" className="todo__btn" {...box('status', filter.status, value)}>
              {STATUS_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      {priorities ? (
        <div className="todo__facet">
          <span className="todo__facet-label">Priority</span>
          <div className="todo__group">
            {PRIORITY_FACETS.map((value) => (
              <button
                key={value}
                type="button"
                className="todo__btn"
                data-priority={value || undefined}
                title={PRIORITY_LABELS[value]}
                {...box('priority', filter.priority, value)}
              >
                {value === 0 ? 'None' : PRIORITY_SHORT[value]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {dueDates ? (
        <div className="todo__facet">
          <span className="todo__facet-label">Due</span>
          <div className="todo__group">
            {BUCKETS.map((value) => (
              <button key={value} type="button" className="todo__btn" {...box('due', filter.due, value)}>
                {DUE_LABELS[value]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="todo__panel-foot">
        <span>
          {shown === total ? `${total} tasks` : `${shown} of ${total} shown`}
        </span>
        {!isFilterEmpty(filter) ? (
          <button type="button" className="todo__link" onClick={() => setFilter(EMPTY_FILTER)}>
            Clear all
          </button>
        ) : null}
      </div>
    </div>
  )
}

// `<input type="date">` speaks ISO in local terms; both helpers stay local.
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
