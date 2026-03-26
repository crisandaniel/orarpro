export interface PublicHoliday {
  date: string       // ISO date: YYYY-MM-DD
  localName: string  // Name in local language
  name: string       // Name in English
  countryCode: string
  fixed: boolean
  global: boolean
  counties: string[] | null
  launchYear: number | null
  types: string[]
}

// Cache to avoid repeated API calls
const cache = new Map<string, PublicHoliday[]>()

/**
 * Fetch public holidays for a given country and year.
 * Uses date.nager.at — free, reliable, 100+ countries.
 */
export async function fetchPublicHolidays(
  countryCode: string,
  year: number
): Promise<PublicHoliday[]> {
  const cacheKey = `${countryCode}-${year}`
  if (cache.has(cacheKey)) return cache.get(cacheKey)!

  try {
    const response = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode.toUpperCase()}`,
      { next: { revalidate: 86400 } } // Cache for 24h in Next.js
    )

    if (!response.ok) {
      console.error(`Failed to fetch holidays for ${countryCode} ${year}`)
      return []
    }

    const holidays: PublicHoliday[] = await response.json()
    cache.set(cacheKey, holidays)
    return holidays
  } catch (error) {
    console.error('Error fetching public holidays:', error)
    return []
  }
}

/**
 * Get holidays within a date range for a schedule.
 */
export async function getHolidaysInRange(
  countryCode: string,
  startDate: string,
  endDate: string
): Promise<PublicHoliday[]> {
  const start = new Date(startDate)
  const end = new Date(endDate)

  // Collect holidays for all years in range
  const years = new Set<number>()
  for (let year = start.getFullYear(); year <= end.getFullYear(); year++) {
    years.add(year)
  }

  const allHolidays = await Promise.all(
    [...years].map(year => fetchPublicHolidays(countryCode, year))
  )

  return allHolidays
    .flat()
    .filter(h => {
      const date = new Date(h.date)
      return date >= start && date <= end
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Check if a specific date is a public holiday.
 */
export async function isPublicHoliday(
  date: string,
  countryCode: string
): Promise<PublicHoliday | null> {
  const year = new Date(date).getFullYear()
  const holidays = await fetchPublicHolidays(countryCode, year)
  return holidays.find(h => h.date === date) ?? null
}

/**
 * Get available countries from date.nager.at
 */
export async function getAvailableCountries(): Promise<Array<{ countryCode: string; name: string }>> {
  try {
    const response = await fetch('https://date.nager.at/api/v3/AvailableCountries', {
      next: { revalidate: 604800 } // Cache for 1 week
    })
    if (!response.ok) return []
    return response.json()
  } catch {
    return []
  }
}
