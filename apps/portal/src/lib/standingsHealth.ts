import 'server-only'

import { createSupabaseServiceRoleClient } from '@namaa-loc/db/server'
import { getCurrentSchoolId } from '@namaa-loc/db/auth.server'

const STALE_THRESHOLD_MS = 30 * 60 * 1000
const HEALTH_CACHE_TTL_MS = 15_000

type StandingsHealthCacheEntry = {
  computedAt: string | null
  fetchedAtMs: number
}

let cachedEntry: StandingsHealthCacheEntry | null = null
let inFlightRead: Promise<StandingsHealthCacheEntry> | null = null

async function fetchLatestComputedAt(): Promise<string | null> {
  const schoolId = await getCurrentSchoolId()
  if (!schoolId) {
    return null
  }

  const healthClient = createSupabaseServiceRoleClient()
  const { data, error } = await healthClient
    .from('house_standings_cache')
    .select('computed_at')
    .eq('school_id', schoolId)
    .order('computed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.computed_at ? String(data.computed_at) : null
}

async function readCachedEntry(): Promise<StandingsHealthCacheEntry> {
  const nowMs = Date.now()

  if (cachedEntry && nowMs - cachedEntry.fetchedAtMs < HEALTH_CACHE_TTL_MS) {
    return cachedEntry
  }

  if (!inFlightRead) {
    inFlightRead = (async () => {
      try {
        const computedAt = await fetchLatestComputedAt()
        const nextEntry = {
          computedAt,
          fetchedAtMs: Date.now(),
        }
        cachedEntry = nextEntry
        return nextEntry
      } catch (error) {
        console.error('Health check failed to read standings cache:', error)

        if (cachedEntry) {
          return cachedEntry
        }

        const fallbackEntry = {
          computedAt: null,
          fetchedAtMs: Date.now(),
        }
        cachedEntry = fallbackEntry
        return fallbackEntry
      } finally {
        inFlightRead = null
      }
    })()
  }

  return inFlightRead
}

export async function getStandingsHealthStatus(now = new Date()) {
  const { computedAt } = await readCachedEntry()

  const isStale = computedAt
    ? now.getTime() - new Date(computedAt).getTime() > STALE_THRESHOLD_MS
    : true

  return {
    ok: true,
    now: now.toISOString(),
    standings_last_updated: computedAt,
    standings_stale: isStale,
  }
}

export function primeStandingsHealthCache(computedAt: string | null) {
  cachedEntry = {
    computedAt,
    fetchedAtMs: Date.now(),
  }
}

export async function prewarmStandingsHealthCache() {
  await readCachedEntry()
}
