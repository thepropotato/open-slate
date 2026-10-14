import { localStore } from '@/core/platform/browser'

/**
 * First-run progress, kept apart from the settings blob so it is never exported, synced or
 * migrated. No record means the tour is over (or never applied: an existing install), and
 * the service worker writes one only on a fresh install.
 */
export const KEY = 'onboarding'

export type Stage = 'welcome' | 'tour' | 'checklist' | 'done'

export interface OnboardingState {
  stage: Stage
  /** Whether the new profile starts with the browser's most visited sites. */
  seed: boolean
  /** Ids of the checklist items already done. */
  tasks: string[]
}

export const TASKS = [
  { id: 'widget', label: 'Add a widget', hint: 'Plus' },
  { id: 'palette', label: 'Open the palette', hint: 'Cmd K' },
  { id: 'arrange', label: 'Arrange the page', hint: 'E' },
] as const

export type TaskId = (typeof TASKS)[number]['id']

const STAGES: Stage[] = ['welcome', 'tour', 'checklist', 'done']

export const fresh = (stage: Stage = 'welcome'): OnboardingState => ({ stage, seed: true, tasks: [] })

/** Anything that is not a well-formed record reads as finished rather than throwing. */
export function parseState(raw: unknown): OnboardingState | null {
  if (!raw || typeof raw !== 'object') return null
  const { stage, seed, tasks } = raw as Partial<OnboardingState>
  if (!stage || !STAGES.includes(stage) || stage === 'done') return null
  const known = new Set<string>(TASKS.map((task) => task.id))
  return {
    stage,
    seed: seed !== false,
    tasks: Array.isArray(tasks) ? tasks.filter((id) => known.has(id)) : [],
  }
}

export const withTask = (state: OnboardingState, id: TaskId): OnboardingState =>
  state.tasks.includes(id) ? state : { ...state, tasks: [...state.tasks, id] }

export const allDone = (state: OnboardingState): boolean => TASKS.every((task) => state.tasks.includes(task.id))

export const loadState = async (): Promise<OnboardingState | null> => parseState(await localStore.get(KEY))
export const saveState = (state: OnboardingState | null): Promise<void> =>
  state ? localStore.set(KEY, state) : localStore.set(KEY, { stage: 'done' })
