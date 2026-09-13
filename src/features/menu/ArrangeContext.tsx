import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

interface Arrange {
  arranging: boolean
  start: () => void
  stop: () => void
}

// Off by default, so the settings preview is a picture that cannot be dragged.
const ArrangeContext = createContext<Arrange>({
  arranging: false,
  start: () => {},
  stop: () => {},
})

/** One arrange mode for the whole page, not one per band. */
export function ArrangeProvider({ children }: { children: ReactNode }) {
  const [arranging, setArranging] = useState(false)
  const start = useCallback(() => setArranging(true), [])
  const stop = useCallback(() => setArranging(false), [])
  return (
    <ArrangeContext.Provider value={useMemo(() => ({ arranging, start, stop }), [arranging, start, stop])}>
      {children}
    </ArrangeContext.Provider>
  )
}

export function useArrange() {
  return useContext(ArrangeContext)
}
