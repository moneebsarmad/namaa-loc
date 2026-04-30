export type SchoolHouseRecord = {
  name?: string | null
  display_name?: string | null
  value?: string | null
  color?: string | null
  icon_url?: string | null
  sort_order?: number | null
  is_active?: boolean | null
}

export type SchoolHouseConfig = {
  name: string
  displayName: string
  value: string
  color: string
  gradient: string
  accentGradient: string
  logo: string
}

const DEFAULT_COLOR = '#1a1a1a'
const DEFAULT_LOGO = '/favicon.ico'

export function normalizeHouseName(value: string): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/['`ʿʾ]/g, "'")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function trimOrEmpty(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toHexColor(value: string | null | undefined, fallback = DEFAULT_COLOR): string {
  const raw = trimOrEmpty(value)
  if (!raw) return fallback
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const [, r, g, b] = raw
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return fallback
}

function shadeColor(hex: string, percent: number): string {
  const normalized = toHexColor(hex, DEFAULT_COLOR).slice(1)
  const amount = Math.round((percent / 100) * 255)
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(normalized.slice(offset, offset + 2), 16)
    const next = Math.max(0, Math.min(255, value + amount))
    return next.toString(16).padStart(2, '0')
  })
  return `#${channels.join('')}`
}

function toGradient(color: string): string {
  const base = toHexColor(color)
  return `linear-gradient(135deg, ${base} 0%, ${shadeColor(base, -18)} 100%)`
}

function toAccentGradient(color: string): string {
  const base = toHexColor(color)
  return `linear-gradient(135deg, ${shadeColor(base, -8)} 0%, ${shadeColor(base, -30)} 100%)`
}

function getDisplayName(record: SchoolHouseRecord): string {
  return trimOrEmpty(record.display_name) || trimOrEmpty(record.name) || trimOrEmpty(record.value) || 'House'
}

function getRawName(record: SchoolHouseRecord): string {
  return trimOrEmpty(record.name) || trimOrEmpty(record.display_name) || trimOrEmpty(record.value) || 'house'
}

function getValue(record: SchoolHouseRecord): string {
  return trimOrEmpty(record.value) || getDisplayName(record)
}

function sortHouses(records: SchoolHouseRecord[]): SchoolHouseRecord[] {
  return [...records].sort((a, b) => {
    const aOrder = Number(a.sort_order ?? Number.MAX_SAFE_INTEGER)
    const bOrder = Number(b.sort_order ?? Number.MAX_SAFE_INTEGER)
    if (aOrder !== bOrder) return aOrder - bOrder
    return getDisplayName(a).localeCompare(getDisplayName(b))
  })
}

function matchHouseName(value: string, records: SchoolHouseRecord[]): SchoolHouseRecord | null {
  const normalized = normalizeHouseName(value)
  if (!normalized) return null

  return records.find((record) => {
    const candidates = [record.display_name, record.name, record.value]
    return candidates.some((candidate) => normalizeHouseName(String(candidate ?? '')) === normalized)
  }) || null
}

export function canonicalHouseName(value: string, records: SchoolHouseRecord[] = []): string {
  const raw = trimOrEmpty(value)
  if (!raw) return ''

  const match = matchHouseName(raw, records)
  return match ? getDisplayName(match) : raw
}

export function getHouseNames(records: SchoolHouseRecord[] = []): string[] {
  return sortHouses(records)
    .map((record) => getDisplayName(record))
    .filter(Boolean)
}

export function getHouseColors(records: SchoolHouseRecord[] = []): Record<string, string> {
  return sortHouses(records).reduce<Record<string, string>>((acc, record) => {
    const displayName = getDisplayName(record)
    const color = toHexColor(record.color)
    acc[displayName] = color
    acc[getRawName(record)] = color
    const value = getValue(record)
    acc[value] = color
    return acc
  }, {})
}

export function getHouseLogoMap(records: SchoolHouseRecord[] = []): Record<string, string> {
  return sortHouses(records).reduce<Record<string, string>>((acc, record) => {
    const displayName = getDisplayName(record)
    const logo = trimOrEmpty(record.icon_url) || DEFAULT_LOGO
    acc[displayName] = logo
    acc[getRawName(record)] = logo
    const value = getValue(record)
    acc[value] = logo
    return acc
  }, {})
}

export function getHouseConfigRecord(records: SchoolHouseRecord[] = []): Record<string, SchoolHouseConfig> {
  return sortHouses(records).reduce<Record<string, SchoolHouseConfig>>((acc, record) => {
    const displayName = getDisplayName(record)
    const color = toHexColor(record.color)
    const config: SchoolHouseConfig = {
      name: displayName,
      displayName,
      value: getValue(record),
      color,
      gradient: toGradient(color),
      accentGradient: toAccentGradient(color),
      logo: trimOrEmpty(record.icon_url) || DEFAULT_LOGO,
    }
    acc[displayName] = config
    acc[getRawName(record)] = config
    acc[config.value] = config
    return acc
  }, {})
}

