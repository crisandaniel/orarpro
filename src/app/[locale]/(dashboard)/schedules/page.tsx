// Schedules list — server component using DAL.

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'
import { getSchedules } from '@/lib/dal/schedules'
import Link from 'next/link'
import { format } from 'date-fns'
import { Plus, Calendar } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

interface Props { params: Promise<{ locale: string }> }

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  draft:      { bg: '#f3f4f6', color: '#6b7280' },
  generating: { bg: '#eff6ff', color: '#2563eb' },
  generated:  { bg: '#fefce8', color: '#854d0e' },
  published:  { bg: '#f0fdf4', color: '#166534' },
}

export default async function SchedulesPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations('schedule')
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const ctx = await getOrgContext(user.id)
  if (!ctx) redirect(`/${locale}/setup`)

  const schedules = await getSchedules(ctx.org.id)
  const orgType = ctx.org.org_type

  const statusLabels: Record<string, string> = {
    draft: t('draft'), generating: t('generating'),
    generated: t('generated'), published: t('published'),
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium" style={{ color: '#111827' }}>{t('title')}</h1>
          <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
            {schedules.length} {schedules.length === 1 ? 'orar' : 'orare'}
          </p>
        </div>
        <Link href={`/${locale}/schedules/new?org=${orgType}`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
          style={{ background: '#2563eb' }}>
          <Plus className="w-4 h-4" /> {t('new')}
        </Link>
      </div>

      {schedules.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center" style={{ border: '0.5px solid #e5e7eb' }}>
          <Calendar className="w-12 h-12 mx-auto mb-4" style={{ color: '#e5e7eb' }} />
          <h3 className="text-base font-medium mb-2" style={{ color: '#374151' }}>
            {t('noSchedules')}
          </h3>
          <p className="text-sm mb-6" style={{ color: '#9ca3af' }}>{t('noSchedulesDesc')}</p>
          <Link href={`/${locale}/schedules/new?org=${orgType}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: '#2563eb' }}>
            <Plus className="w-4 h-4" /> {t('new')}
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e7eb' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '0.5px solid #e5e7eb' }}>
                {[t('name'), t('period'), t('type'), t('status'), ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium"
                    style={{ color: '#9ca3af' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {schedules.map((s, i) => {
                const st = STATUS_STYLES[s.status] ?? STATUS_STYLES.draft
                return (
                  <tr key={s.id} style={{ borderBottom: i < schedules.length - 1 ? '0.5px solid #f3f4f6' : 'none' }}
                    className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium" style={{ color: '#111827' }}>{s.name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#6b7280' }}>
                      {format(new Date(s.start_date), 'd MMM')} – {format(new Date(s.end_date), 'd MMM yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: s.type === 'school' ? '#ede9fe' : '#eff6ff', color: s.type === 'school' ? '#7c3aed' : '#2563eb' }}>
                        {s.type === 'school' ? 'Școlar' : 'Ture'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: st.bg, color: st.color }}>
                        {statusLabels[s.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/${locale}/schedules/${s.id}`}
                        className="text-xs font-medium" style={{ color: '#2563eb' }}>
                        Deschide →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
