import { useEffect, useState } from 'react'
import { appClock } from './clock'

/** Marca de tiempo redondeada al minuto; re-renderiza solo una vez por minuto. */
export function useMinute(): number {
  const [m, setM] = useState(() => Math.floor(appClock.now() / 60_000) * 60_000)
  useEffect(() => {
    const id = setInterval(() => setM(Math.floor(appClock.now() / 60_000) * 60_000), 15_000)
    return () => clearInterval(id)
  }, [])
  return m
}
