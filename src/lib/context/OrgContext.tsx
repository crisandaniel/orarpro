'use client'

// ─────────────────────────────────────────────────────────────────────────────
// src/lib/context/OrgContext.tsx
// React context for the active organization.
// Loaded ONCE in dashboard layout (server-side) and provided to all client components.
// Use the useOrg() hook anywhere in the dashboard tree.
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useContext } from 'react'
import type { OrgContextData } from '@/types'

const OrgContext = createContext<OrgContextData | null>(null)

export function OrgProvider({
  value,
  children,
}: {
  value: OrgContextData
  children: React.ReactNode
}) {
  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>
}

/**
 * Hook to access the active org context in any client component.
 * Must be used inside the dashboard layout (wrapped by OrgProvider).
 */
export function useOrg(): OrgContextData {
  const ctx = useContext(OrgContext)
  if (!ctx) throw new Error('useOrg must be used within OrgProvider (dashboard layout)')
  return ctx
}

/**
 * Safe version — returns null if outside OrgProvider.
 * Use when the component might render outside the dashboard.
 */
export function useOrgSafe(): OrgContextData | null {
  return useContext(OrgContext)
}
