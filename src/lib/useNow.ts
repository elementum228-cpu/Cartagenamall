import { useEffect, useState } from 'react'
import { appClock } from './clock'

/** Reloj compartido para contadores regresivos y vencimiento de promociones. */
const listeners = new Set<(t: number) => void>()
let timer: ReturnType<typeof setInterval> | null = null

export function useNow(): number {
  const [now, setNow] = useState(() => appClock.now())
  useEffect(() => {
    listeners.add(setNow)
    if (!timer) timer = setInterval(() => listeners.forEach((l) => l(appClock.now())), 1000)
    return () => {
      listeners.delete(setNow)
      if (!listeners.size && timer) {
        clearInterval(timer)
        timer = null
      }
    }
  }, [])
  return now
}
