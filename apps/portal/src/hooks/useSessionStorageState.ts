import { useEffect, useState } from 'react'

export function useSessionStorageState<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return defaultValue
    const stored = window.sessionStorage.getItem(key)
    if (!stored) return defaultValue
    try {
      return JSON.parse(stored) as T
    } catch {
      return defaultValue
    }
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Ignore storage errors (quota, private mode)
    }
  }, [key, value])

  return [value, setValue] as const
}
