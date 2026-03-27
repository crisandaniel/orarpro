// Public holiday utilities using the free date.nager.at API.
// getPublicHolidays(country, year): cached in memory for 24h.
// getHolidaysInRange(country, start, end): handles multi-year ranges.
// isHoliday(date, holidays): O(n) lookup for a specific date.
// getSupportedCountries(): 100+ countries supported.
// Used by: generate route, schedule view page.

export interface PublicHoliday {
  date: string
  localName: string
  name: string
  countryCode: string
  fixed: boolean
  global: boolean
}

const API_BASE = 'https://date.nager.at/api/v3'

// Cache holidays in memory per country+year to avoid repeated fetches
const cache = new Map<string, PublicHoliday[]>()

export async function getPublicHolidays(
  countryCode: string,
  year: number
): Promise<PublicHoliday[]> {
  const key = `${countryCode}-${year}`

  if (cache.has(key)) {
    return cache.get(key)!
  }

  try {
    const res = await fetch(`${API_BASE}/PublicHolidays/${year}/${countryCode}`, {
      next: { revalidate: 86400 }, // cache for 24h in Next.js
    })

    if (!res.ok) return []

    const data: PublicHoliday[] = await res.json()
    cache.set(key, data)
    return data
  } catch {
    console.error(`Failed to fetch holidays for ${countryCode} ${year}`)
    return []
  }
}

// Get holidays across a date range (may span multiple years)
export async function getHolidaysInRange(
  countryCode: string,
  startDate: string,
  endDate: string
): Promise<PublicHoliday[]> {
  const start = new Date(startDate)
  const end = new Date(endDate)

  const years = new Set<number>()
  for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
    years.add(y)
  }

  const allHolidays = await Promise.all(
    Array.from(years).map((y) => getPublicHolidays(countryCode, y))
  )

  return allHolidays
    .flat()
    .filter((h) => h.date >= startDate && h.date <= endDate)
}

// Check if a specific date is a public holiday
export function isHoliday(
  date: string,
  holidays: PublicHoliday[]
): PublicHoliday | undefined {
  return holidays.find((h) => h.date === date)
}

// Get supported countries from nager.at
export async function getSupportedCountries(): Promise<
  { countryCode: string; name: string }[]
> {
  try {
    const res = await fetch(`${API_BASE}/AvailableCountries`, {
      next: { revalidate: 604800 }, // cache for 1 week
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}
