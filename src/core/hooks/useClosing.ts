import { useState, useCallback, useEffect, useRef } from 'react'

export function useClosing(onClose: () => void, durationMs: number = 200) {
  const [closing, setClosing] = useState(false)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  const handleClose = useCallback(() => {
    setClosing(true)
  }, [])

  useEffect(() => {
    if (closing) {
      const timer = setTimeout(() => {
        onCloseRef.current()
      }, durationMs)
      return () => clearTimeout(timer)
    }
  }, [closing, durationMs])

  return { closing, handleClose }
}
