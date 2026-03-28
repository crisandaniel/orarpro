// Dashboard page — overview with stats and quick actions.
// Server component — reads org from DAL, no prop drilling.

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/dal/org'
import { getSchedules } from '@/lib/dal/schedules'
import { getEmployees } from '@/lib/dal/employees'
import Link from 'next/link'
import { Calendar, Users, Plus, Zap } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { format } from 'date-fns'

interface Props { params: Promise<{ locale: string }> }

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:      { bg: '#f3f4f6', color: '#6b7280',  label: 'Ciornă' },
  generating: { bg: '#eff6ff', color: '#2563eb',  label: 'Se generează' },
  generated:  { bg: '#fefce8', color: '#854d0e',  label: 'Generat' },
  published:  { bg: '#f0fdf4', color: '#166534',  label: 'Publicat' },
}

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const ctx = await getOrgContext(user.id)
  if (!ctx) redirect(`/${locale}/setup`)

  const { org } = ctx
  const isEducation = org.org_type === 'education'

  const [schedules, employees] = await Promise.all([
    getSchedules(org.id),
    getEmployees(org.id),
  ])

  const recentSchedules = schedules.slice(0, 5)

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium" style={{ color: '#111827' }}>
          Bun venit, {ctx.profile.full_name ?? ctx.profile.email?.split('@')[0]}
        </h1>
        <p className="text-sm mt-1" style={{ color: '#9ca3af' }}>
          {org.name} · {isEducation ? 'Instituție de educație' : 'Organizație business'}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Orare totale', value: schedules.length, icon: Calendar, color: '#2563eb' },
          { label: isEducation ? 'Profesori' : 'Angajați activi', value: employees.length, icon: Users, color: '#7c3aed' },
          { label: 'Orare publicate', value: schedules.filter(s => s.status === 'published').length, icon: Zap, color: '#059669' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-5" style={{ border: '0.5px solid #e5e7eb' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm" style={{ color: '#9ca3af' }}>{label}</span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `${color}18` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-medium" style={{ color: '#111827' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Recent schedules */}
      <div className="bg-white rounded-xl" style={{ border: '0.5px solid #e5e7eb' }}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '0.5px solid #f3f4f6' }}>
          <h2 className="text-sm font-medium" style={{ color: '#111827' }}>Orare recente</h2>
          <Link href={`/${locale}/schedules/new?org=${org.org_type}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
            style={{ background: '#2563eb' }}>
            <Plus className="w-3 h-3" /> Orar nou
          </Link>
        </div>

        {recentSchedules.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: '#e5e7eb' }} />
            <p className="text-sm font-medium mb-1" style={{ color: '#374151' }}>
              Niciun orar încă
            </p>
            <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>
              Creează primul tău orar automat
            </p>
            <Link href={`/${locale}/schedules/new?org=${org.org_type}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: '#2563eb' }}>
              <Plus className="w-4 h-4" /> Orar nou
            </Link>
          </div>
        ) : (
          recentSchedules.map((s, i) => {
            const st = STATUS_STYLES[s.status] ?? STATUS_STYLES.draft
            return (
              <Link key={s.id} href={`/${locale}/schedules/${s.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
                style={{ borderBottom: i < recentSchedules.length - 1 ? '0.5px solid #f9fafb' : 'none' }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: '#111827' }}>{s.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                    {format(new Date(s.start_date), 'd MMM')} – {format(new Date(s.end_date), 'd MMM yyyy')}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: st.bg, color: st.color }}>
                  {st.label}
                </span>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
