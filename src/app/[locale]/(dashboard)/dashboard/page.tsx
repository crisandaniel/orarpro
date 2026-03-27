// Main dashboard — 3 stat cards (active schedules, employees, total) + recent schedules.
// Server component; fetches data directly from Supabase.
// Used by: authenticated users as the home screen after login.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Users, Plus, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'
import { getTranslations } from 'next-intl/server'

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const t = await getTranslations('dashboard')
  const tSchedule = await getTranslations('schedule')

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const { data: membership } = await supabase
    .from('organization_members').select('organization_id')
    .eq('user_id', user.id).single()

  const orgId = membership?.organization_id

  const [schedulesResult, employeesResult] = await Promise.all([
    supabase.from('schedules').select('*').eq('organization_id', orgId ?? '').order('created_at', { ascending: false }).limit(5),
    supabase.from('employees').select('id', { count: 'exact' }).eq('organization_id', orgId ?? '').eq('is_active', true),
  ])

  const schedules = schedulesResult.data ?? []
  const employeeCount = employeesResult.count ?? 0
  const activeSchedules = schedules.filter((s) => s.status === 'published').length
  const firstName = profile?.full_name?.split(' ')[0] ?? ''

  const statusColors: Record<string, { bg: string; color: string }> = {
    draft:      { bg: '#f3f4f6', color: '#6b7280' },
    generating: { bg: '#eff6ff', color: '#2563eb' },
    generated:  { bg: '#fefce8', color: '#854d0e' },
    published:  { bg: '#f0fdf4', color: '#166534' },
  }

  const statusLabels: Record<string, string> = {
    draft: tSchedule('draft'),
    generating: tSchedule('generating'),
    generated: tSchedule('generated'),
    published: tSchedule('published'),
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium" style={{ color: '#111827' }}>
            {t('welcomeBack', { name: firstName })}
          </h1>
          <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
            {format(new Date(), 'EEEE, d MMMM yyyy')}
          </p>
        </div>
        <Link href={`/${locale}/schedules/new`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
          style={{ background: '#2563eb' }}>
          <Plus className="w-4 h-4" />
          {t('newSchedule')}
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: t('activeSchedules'), value: activeSchedules, icon: Calendar, color: '#2563eb', bg: '#eff6ff' },
          { label: t('totalEmployees'),  value: employeeCount,   icon: Users,    color: '#059669', bg: '#f0fdf4' },
          { label: t('totalSchedules'),  value: schedules.length, icon: TrendingUp, color: '#d97706', bg: '#fffbeb' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl p-5" style={{ border: '0.5px solid #e5e7eb' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <span className="text-sm" style={{ color: '#6b7280' }}>{label}</span>
            </div>
            <p className="text-3xl font-medium" style={{ color: '#111827' }}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '0.5px solid #e5e7eb' }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '0.5px solid #f3f4f6' }}>
          <h2 className="text-sm font-medium" style={{ color: '#111827' }}>{t('recentSchedules')}</h2>
          <Link href={`/${locale}/schedules`} className="text-xs" style={{ color: '#2563eb' }}>
            {t('viewAll')}
          </Link>
        </div>

        {schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
              style={{ background: '#eff6ff' }}>
              <Calendar className="w-5 h-5" style={{ color: '#2563eb' }} />
            </div>
            <p className="text-sm mb-1 font-medium" style={{ color: '#111827' }}>{t('noSchedules')}</p>
            <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>{t('noSchedulesHint')}</p>
            <Link href={`/${locale}/schedules/new`}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: '#2563eb' }}>
              {t('createSchedule')}
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {schedules.map((s, i) => {
                const sc = statusColors[s.status] ?? statusColors.draft
                return (
                  <tr key={s.id}
                    style={{ borderBottom: i < schedules.length - 1 ? '0.5px solid #f9fafb' : 'none' }}
                    className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/${locale}/schedules/${s.id}`}
                        className="font-medium hover:underline" style={{ color: '#111827' }}>
                        {s.name}
                      </Link>
                      <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                        {format(new Date(s.start_date), 'd MMM')} – {format(new Date(s.end_date), 'd MMM yyyy')}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-right">
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
        )}
      </div>
    </div>
  )
}
