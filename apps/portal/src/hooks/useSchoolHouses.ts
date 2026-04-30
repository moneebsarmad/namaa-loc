'use client'

import { useEffect, useState } from 'react'

import type { SchoolHouseRecord } from '@/lib/schoolHouses'

type HousesResponse = {
  houses?: SchoolHouseRecord[]
  error?: string
}

export function useSchoolHouses(enabled = true) {
  const [houses, setHouses] = useState<SchoolHouseRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    if (!enabled) {
      setHouses([])
      setLoading(false)
      return () => controller.abort()
    }

    const fetchHouses = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/school-houses', {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
        })
        const data = (await response.json().catch(() => null)) as HousesResponse | null
        if (!response.ok) {
          setHouses([])
          return
        }
        setHouses(Array.isArray(data?.houses) ? data!.houses! : [])
      } catch {
        if (!controller.signal.aborted) {
          setHouses([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchHouses()

    return () => controller.abort()
  }, [enabled])

  return { houses, loading }
}

