// Shared utility functions used throughout the app.
// cn(...classes): merges Tailwind class names safely (clsx + tailwind-merge).
// formatHours(h): formats decimal hours as '8h 30m'.
// getInitials(name): extracts initials from a full name ('Ion Popescu' → 'IP').
// Used by: components for class merging and display formatting.

import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
