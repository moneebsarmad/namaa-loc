/**
 * School Configuration
 *
 * This file contains all school-specific branding and configuration.
 * To customize for a different school, update the values below.
 *
 * For production deployments, you can also use environment variables
 * to override these values.
 */

export interface HouseConfig {
  name: string
  color: string
  gradient: string
  accentGradient: string
  logo: string
  // Aliases for matching database values (handles unicode variations)
  aliases: string[]
}

export interface SchoolConfig {
  // School Identity
  schoolName: string
  systemName: string
  tagline: string

  // Branding Assets
  crestLogo: string
  favicon: string

  // Colors
  colors: {
    primary: string
    primaryLight: string
    accent: string
    accentLight: string
    accentDark: string
    background: string
    backgroundAlt: string
    text: string
  }

  // House System
  houses: HouseConfig[]

  // Merit Categories (3R System or custom)
  meritCategories: {
    name: string
    description: string
  }[]

  // Hall of Fame / Club Tiers
  clubTiers: {
    name: string
    points: number
    icon: string
    gradientColors: string
    viewName: string
  }[]

  // Academic Year Configuration
  academicYear: {
    startMonth: number // 1-12
    quarters: {
      name: string
      startDate: string // MM-DD format
      endDate: string   // MM-DD format
    }[]
  }
}

// =============================================================================
// DEMO SCHOOL CONFIGURATION
// =============================================================================
// This is the default demo configuration. For BHA or other schools,
// create a separate config file or use environment variables.

const demoConfig: SchoolConfig = {
  // School Identity
  schoolName: 'Dār al-Arqam Islamic School',
  systemName: 'League of Champions',
  tagline: 'Where Champions Are Made',

  // Branding Assets
  crestLogo: '/demo-crest.svg',
  favicon: '/favicon.ico',

  // Colors - Nama Systems Forest & Gold theme
  colors: {
    primary: '#2D5016',      // Forest Green
    primaryLight: '#3d6b1e',
    accent: '#B8860B',       // Gold
    accentLight: '#d4a017',
    accentDark: '#8b6508',
    background: '#F8F9FA',   // Soft Gray
    backgroundAlt: '#FFFFFF', // White
    text: '#1a1a1a',         // Dark
  },

  // House System - 4 Houses
  houses: [
    {
      name: 'House of Abū Bakr',
      color: '#2f0a61',
      gradient: 'linear-gradient(135deg, #4a1a8a 0%, #2f0a61 50%, #1a0536 100%)',
      accentGradient: 'linear-gradient(135deg, #6b2fad 0%, #4a1a8a 100%)',
      logo: '/house_of_abubakr.png',
      aliases: ['abu bakr', 'abubakr', 'abu-bakr', 'bakr'],
    },
    {
      name: 'House of Khadījah',
      color: '#055437',
      gradient: 'linear-gradient(135deg, #0a7a50 0%, #055437 50%, #033320 100%)',
      accentGradient: 'linear-gradient(135deg, #0d9963 0%, #0a7a50 100%)',
      logo: '/house_of_khadijah.png',
      aliases: ['khadijah', 'khadija', 'khad'],
    },
    {
      name: 'House of ʿUmar',
      color: '#000068',
      gradient: 'linear-gradient(135deg, #1a1a9a 0%, #000068 50%, #000040 100%)',
      accentGradient: 'linear-gradient(135deg, #2a2ab8 0%, #1a1a9a 100%)',
      logo: '/house_of_umar.png',
      aliases: ['umar', 'omar'],
    },
    {
      name: 'House of ʿĀʾishah',
      color: '#910000',
      gradient: 'linear-gradient(135deg, #c41a1a 0%, #910000 50%, #5a0000 100%)',
      accentGradient: 'linear-gradient(135deg, #e02d2d 0%, #c41a1a 100%)',
      logo: '/house_of_aishah.png',
      aliases: ['aishah', 'aisha', 'ayesha'],
    },
  ],

  // Merit Categories
  meritCategories: [
    { name: 'Respect', description: 'Showing respect to peers, teachers, and environment' },
    { name: 'Responsibility', description: 'Taking ownership and being accountable' },
    { name: 'Righteousness', description: 'Acting with integrity and moral courage' },
  ],

  // Club Tiers
  clubTiers: [
    { name: 'Century Club', points: 100, icon: '💯', gradientColors: 'from-[#6b4a1a] to-[#b08a2e]', viewName: 'century_club' },
    { name: 'Badr Club', points: 300, icon: '🌙', gradientColors: 'from-[#23523b] to-[#3a7b59]', viewName: 'badr_club' },
    { name: 'Fath Club', points: 700, icon: '🏆', gradientColors: 'from-[#1f2a44] to-[#3b537a]', viewName: 'fath_club' },
  ],

  // Academic Year
  academicYear: {
    startMonth: 8, // August
    quarters: [
      { name: 'Q1', startDate: '01-06', endDate: '03-06' },
      { name: 'Q2', startDate: '03-09', endDate: '05-21' },
      { name: 'Q3', startDate: '08-15', endDate: '10-15' },
      { name: 'Q4', startDate: '10-18', endDate: '12-20' },
    ],
  },
}

// =============================================================================
// BHA CONFIGURATION (Brighter Horizon Academy / Beaconhouse Al-Azhar)
// =============================================================================

const bhaConfig: SchoolConfig = {
  ...demoConfig,
  schoolName: 'Dār al-Arqam Islamic School',
  systemName: 'League of Champions',
  tagline: 'Where Champions Are Made',
  crestLogo: '/crest.png', // BHA-specific crest
}

// =============================================================================
// CONFIGURATION SELECTOR
// =============================================================================

// Use environment variable to select configuration
// Set NEXT_PUBLIC_SCHOOL_CONFIG=demo to use demo assets locally.
const configName = process.env.NEXT_PUBLIC_SCHOOL_CONFIG || 'bha'

export const schoolConfig: SchoolConfig = configName === 'bha' ? bhaConfig : demoConfig

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get house configuration by name (handles unicode normalization)
 */
export function getHouseConfig(houseName: string): HouseConfig | undefined {
  const normalized = houseName
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[''`ʿʾ]/g, "'")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')

  return schoolConfig.houses.find((house) => {
    // Direct match
    const houseNormalized = house.name
      .normalize('NFKD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[''`ʿʾ]/g, "'")
      .toLowerCase()
      .trim()

    if (houseNormalized === normalized) return true

    // Check aliases
    return house.aliases.some((alias) => normalized.includes(alias))
  })
}

/**
 * Canonicalize a house name to its proper form
 */
export function canonicalHouseName(houseName: string): string {
  const config = getHouseConfig(houseName)
  return config?.name || houseName
}

/**
 * Get house config as a Record for easy lookup
 */
export function getHouseConfigRecord(): Record<string, { color: string; gradient: string; accentGradient: string; logo: string }> {
  return schoolConfig.houses.reduce((acc, house) => {
    acc[house.name] = {
      color: house.color,
      gradient: house.gradient,
      accentGradient: house.accentGradient,
      logo: house.logo,
    }
    return acc
  }, {} as Record<string, { color: string; gradient: string; accentGradient: string; logo: string }>)
}

/**
 * Get house colors as a simple Record
 */
export function getHouseColors(): Record<string, string> {
  return schoolConfig.houses.reduce((acc, house) => {
    acc[house.name] = house.color
    return acc
  }, {} as Record<string, string>)
}

/**
 * Get list of house names
 */
export function getHouseNames(): string[] {
  return schoolConfig.houses.map((house) => house.name)
}

// Export individual values for convenience
export const SCHOOL_NAME = schoolConfig.schoolName
export const SYSTEM_NAME = schoolConfig.systemName
export const CREST_LOGO = schoolConfig.crestLogo
export const COLORS = schoolConfig.colors
