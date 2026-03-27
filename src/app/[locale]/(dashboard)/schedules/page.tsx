// Schedules list — table of all schedules for the organization.
// Empty state with CTA when no schedules exist.
// Used by: nav link 'Orare'.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Plus, Calendar } from 'lucide-react'
import { getTranslations } from 'next-intl/server'

export default async function SchedulesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('schedule')

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: membership } = await supabase
    .from('organization_members').select('organization_id').eq('user_id', user.id).single()

  const { data: schedules } = await supabase
    .from('schedules').select('*')
    .eq('organization_id', membership?.organization_id ?? '')
    .order('created_at', { ascending: false })

  const statusColors: Record<string, { bg: string; color: string }> = {
    draft:      { bg: '#f3f4f6', color: '#6b7280' },
    generating: { bg: '#eff6ff', color: '#2563eb' },
    generated:  { bg: '#fefce8', color: '#854d0e' },
    published:  { bg: '#f0fdf4', color: '#166534' },
  }

  const statusLabels: Record<string, string> = {
    draft: t('draft'), generating: t('generating'),
    generated: t('generated'), published: t('published'),
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium" style={{ color: '#111827' }}>{t('title')}</h1>
          <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
            {schedules?.length ?? 0} {(schedules?.length ?? 0) === 1 ? 'orar' : 'orare'}
          </p>
        </div>
        <Link href={`/${locale}/schedules/new`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
          style={{ background: '#2563eb' }}>
          <Plus className="w-4 h-4" />
          {t('new')}
        </Link>
      </div>

      {!schedules || schedules.length === 0 ? (
        <div className="bg-white rounded-xl flex flex-col items-center justify-center py-20 text-center"
          style={{ border: '0.5px solid #e5e7eb' }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
            style={{ background: '#eff6ff' }}>
            <Calendar className="w-6 h-6" style={{ color: '#2563eb' }} />
          </div>
          <h3 className="text-base font-medium mb-2" style={{ color: '#111827' }}>{t('noSchedules')}</h3>
          <p className="text-sm mb-6 max-w-xs" style={{ color: '#6b7280' }}>{t('noSchedulesHint')}</p>
          <Link href={`/${locale}/schedules/new`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: '#2563eb' }}>
            <Plus className="w-4 h-4" />
            {t('createFirst')}
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e7eb' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '0.5px solid #f3f4f6', background: '#f9fafb' }}>
                <th className="text-left px-5 py-3 font-medium" style={{ color: '#6b7280' }}>{t('name_col')}</th>
                <th className="text-left px-5 py-3 font-medium" style={{ color: '#6b7280' }}>{t('period_col')}</th>
                <th className="text-left px-5 py-3 font-medium" style={{ color: '#6b7280' }}>{t('type_col')}</th>
                <th className="text-left px-5 py-3 font-medium" style={{ color: '#6b7280' }}>{t('status_col')}</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s, i) => {
                const sc = statusColors[s.status] ?? statusColors.draft
                return (
                  <tr key={s.id}
                    style={{ borderBottom: i < schedules.length - 1 ? '0.5px solid #f3f4f6' : 'none' }}
                    className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/${locale}/schedules/${s.id}`}
                        className="font-medium hover:underline" style={{ color: '#111827' }}>
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3" style={{ color: '#6b7280' }}>
                      {format(new Date(s.start_date), 'd MMM')} – {format(new Date(s.end_date), 'd MMM yyyy')}
                    </td>
                    <td className="px-5 py-3 capitalize" style={{ color: '#6b7280' }}>
                      {s.type === 'shifts' ? t('typeShifts').split('(')[0].trim() : t('typeSchool').split('/')[0].trim()}
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium"
                        style={{ background: sc.bg, color: sc.color }}>
                        {statusLabels[s.status] ?? s.status}
                      </span>
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
