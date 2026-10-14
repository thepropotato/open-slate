import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { localStore } from '@/core/platform/browser'
import { KEY, fresh, loadState, parseState, saveState, type OnboardingState, type Stage } from './state'

interface OnboardingApi {
  /** False until storage has answered; nothing should act on first-run state before then. */
  ready: boolean
  state: OnboardingState | null
  patch: (change: Partial<OnboardingState> | ((current: OnboardingState) => OnboardingState)) => void
  start: (stage: Stage) => void
  finish: () => void
}

const Context = createContext<OnboardingApi | null>(null)

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<OnboardingState | null>(null)

  useEffect(() => {
    let alive = true
    void loadState().then((loaded) => {
      if (!alive) return
      setState(loaded)
      setReady(true)
    })
    // Another tab finishing the tour ends it here too.
    const stop = localStore.subscribe(KEY, (value) => setState(parseState(value)))
    return () => {
      alive = false
      stop()
    }
  }, [])

  const commit = useCallback((next: OnboardingState | null) => {
    setState(next)
    void saveState(next)
  }, [])

  const patch = useCallback<OnboardingApi['patch']>(
    (change) => {
      setState((current) => {
        const base = current ?? fresh('tour')
        const next = typeof change === 'function' ? change(base) : { ...base, ...change }
        void saveState(next)
        return next
      })
    },
    [],
  )

  const api = useMemo<OnboardingApi>(
    () => ({
      ready,
      state,
      patch,
      start: (stage) => commit(fresh(stage)),
      finish: () => commit(null),
    }),
    [ready, state, patch, commit],
  )

  return <Context.Provider value={api}>{children}</Context.Provider>
}

export const useOnboarding = (): OnboardingApi | null => useContext(Context)

/** Whether an empty tile grid may fill itself from the browser's most visited sites. */
export function useSeedGate(): boolean {
  const onboarding = useOnboarding()
  if (!onboarding) return true
  return onboarding.ready && onboarding.state?.seed !== false
}
