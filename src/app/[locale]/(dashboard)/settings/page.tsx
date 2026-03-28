// Settings page — profile + org info + GDPR.
// Server component, uses DAL for consistent org loading.

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'
import { getTranslations } from 'next-intl/server'
import { OrgSettings } from '@/components/settings/OrgSettings'

interface Props { params: Promise<{ locale: string }> }

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('settings')
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const ctx = await getOrgContext(user.id)
  if (!ctx) redirect(`/${locale}/setup`)

  const { profile, org, role } = ctx

  const row = (label: string, value: string | undefined) => (
    <div className="flex justify-between py-2.5" style={{ borderBottom: '0.5px solid #f3f4f6' }}>
      <span className="text-sm" style={{ color: '#6b7280' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: '#111827' }}>{value ?? '—'}</span>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-medium" style={{ color: '#111827' }}>{t('title')}</h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>{t('subtitle')}</p>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e7eb' }}>
        <h2 className="text-base font-medium mb-4" style={{ color: '#111827' }}>{t('profile')}</h2>
        {row(t('fullName'), profile.full_name ?? undefined)}
        {row(t('email'), profile.email)}
        <div className="flex justify-between py-2.5">
          <span className="text-sm" style={{ color: '#6b7280' }}>{t('memberSince')}</span>
          <span className="text-sm font-medium" style={{ color: '#111827' }}>
            {new Date(profile.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Organization */}
      <div className="bg-white rounded-xl p-6 mb-4" style={{ border: '0.5px solid #e5e7eb' }}>
        <h2 className="text-base font-medium mb-4" style={{ color: '#111827' }}>{t('organization')}</h2>
        <OrgSettings
          org={{ id: org.id, name: org.name, org_type: org.org_type }}
          role={role}
        />
        {row(t('country'), org.country_code)}
        {row(t('plan'), org.plan)}
        <div className="flex justify-between py-2.5">
          <span className="text-sm" style={{ color: '#6b7280' }}>{t('role')}</span>
          <span className="text-sm font-medium capitalize" style={{ color: '#111827' }}>{role}</span>
        </div>
      </div>

      {/* Privacy / GDPR */}
      <div className="bg-white rounded-xl p-6" style={{ border: '0.5px solid #e5e7eb' }}>
        <h2 className="text-base font-medium mb-1" style={{ color: '#111827' }}>{t('privacy')}</h2>
        <p className="text-sm mb-4" style={{ color: '#6b7280' }}>{t('privacyDesc')}</p>
        <div className="flex gap-3">
          <button className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ border: '0.5px solid #d1d5db', color: '#374151', background: '#fff' }}>
            {t('exportData')}
          </button>
          <button className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ border: '0.5px solid #fecaca', color: '#dc2626', background: '#fff' }}>
            {t('deleteAccount')}
          </button>
        </div>
      </div>
    </div>
  )
}
