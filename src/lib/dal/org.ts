// ─────────────────────────────────────────────────────────────────────────────
// src/lib/dal/org.ts
// Data Access Layer for organizations and profiles.
// All org-related DB queries go through here — never scattered in pages/layouts.
// Uses createAdminClient() for reliability (bypasses RLS issues on reads too).
// ─────────────────────────────────────────────────────────────────────────────

import { createAdminClient } from '@/lib/supabase/server'
import type { OrgContextData, Organization, Profile, UserRole } from '@/types'

/**
 * Load everything the dashboard needs about the current user + org.
 * Called once in the dashboard layout — result passed via OrgProvider.
 * Returns null if user has no organizations (redirect to setup).
 */
export async function getOrgContext(userId: string): Promise<OrgContextData | null> {
  const admin = createAdminClient()

  // Load profile (includes active_organization_id)
  const { data: profile } = await admin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!profile) return null

  // Load all orgs for this user in one query
  const { data: memberships } = await admin
    .from('organization_members')
    .select('role, organization_id, organizations(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (!memberships || memberships.length === 0) return null

  const allOrgs = memberships
    .map((m: any) => m.organizations)
    .filter(Boolean) as Organization[]

  // Determine active org: from profile preference, else first
  const activeOrgId = profile.active_organization_id
  const activeMembership = activeOrgId
    ? memberships.find((m: any) => m.organization_id === activeOrgId)
    : memberships[0]

  const org = (activeMembership as any)?.organizations as Organization | undefined
  if (!org) return null

  // Normalize org_type (legacy orgs may have null)
  const normalizedOrg: Organization = {
    ...org,
    org_type: org.org_type ?? 'business',
  }

  const normalizedAllOrgs = allOrgs.map(o => ({
    ...o,
    org_type: o.org_type ?? 'business',
  })) as Organization[]

  return {
    profile: profile as Profile,
    org: normalizedOrg,
    allOrgs: normalizedAllOrgs,
    role: (activeMembership as any).role as UserRole,
  }
}

/**
 * Switch the active organization for a user.
 * Verifies membership before switching.
 */
export async function switchActiveOrg(userId: string, orgId: string): Promise<boolean> {
  const admin = createAdminClient()

  // Verify membership
  const { data: membership } = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .single()

  if (!membership) return false

  const { error } = await admin
    .from('profiles')
    .update({ active_organization_id: orgId })
    .eq('id', userId)

  return !error
}

/**
 * Get org membership role for a user.
 */
export async function getUserRole(userId: string, orgId: string): Promise<UserRole | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('organization_members')
    .select('role')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .single()
  return data?.role as UserRole ?? null
}
