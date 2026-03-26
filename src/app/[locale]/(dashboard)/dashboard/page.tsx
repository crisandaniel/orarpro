import { createServerSupabaseClient } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Users, Plus, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id, organizations(*)')
    .eq('user_id', user.id)
    .single()

  const orgId = membership?.organization_id

  const [schedulesResult, employeesResult] = await Promise.all([
    supabase
      .from('schedules')
      .select('*')
      .eq('organization_id', orgId ?? '')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('employees')
      .select('id', { count: 'exact' })
      .eq('organization_id', orgId ?? '')
      .eq('is_active', true),
  ])

  const schedules = schedulesResult.data ?? []
  const employeeCount = employeesResult.count ?? 0

  const activeSchedules = schedules.filter((s) => s.status === 'published').length

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold">Welcome back, {firstName}!</h1>
          <p className="text-gray-500 text-sm mt-1">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
        <Link
          href="/schedules/new"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New schedule
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-950 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-indigo-600" />
            </div>
            <span className="text-sm text-gray-500">Active schedules</span>
          </div>
          <p className="text-3xl font-semibold">{activeSchedules}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-green-50 dark:bg-green-950 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">Total employees</span>
          </div>
          <p className="text-3xl font-semibold">{employeeCount}</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-amber-50 dark:bg-amber-950 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-sm text-gray-500">Schedules this month</span>
          </div>
          <p className="text-3xl font-semibold">{schedules.length}</p>
        </div>
      </div>

      {/* Recent schedules */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-medium">Recent schedules</h2>
          <Link href="/schedules" className="text-sm text-indigo-600 hover:underline">
            View all
          </Link>
        </div>

        {schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <Calendar className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-500 mb-4">No schedules yet</p>
            <Link
              href="/schedules/new"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Create your first schedule
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {schedules.map((schedule) => (
              <li key={schedule.id}>
                <Link
                  href={`/schedules/${schedule.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm">{schedule.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {format(new Date(schedule.start_date), 'd MMM')} –{' '}
                      {format(new Date(schedule.end_date), 'd MMM yyyy')}
                    </p>
                  </div>
                  <StatusBadge status={schedule.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    generating: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    generated: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    published: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  }

  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${styles[status] ?? styles.draft}`}>
      {status}
    </span>
  )
}
