'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  Calendar,
  Users,
  Settings,
  CreditCard,
  LogOut,
  ChevronDown,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { Profile, Organization } from '@/types'

interface SidebarNavProps {
  profile: Profile | null
  organization: Organization | null
}

export function SidebarNav({ profile, organization }: SidebarNavProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const links = [
    { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { href: '/schedules', label: t('schedules'), icon: Calendar },
    { href: '/employees', label: t('employees'), icon: Users },
    { href: '/settings', label: t('settings'), icon: Settings },
    { href: '/billing', label: t('billing'), icon: CreditCard },
  ]

  return (
    <aside className="w-60 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-800">
        <span className="text-xl font-bold text-indigo-600">OrarPro</span>
      </div>

      {/* Organization selector */}
      {organization && (
        <div className="px-3 py-3 border-b border-gray-100 dark:border-gray-800">
          <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{organization.name}</p>
              <p className="text-xs text-gray-500 capitalize">{organization.plan} plan</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname.includes(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User profile + logout */}
      <div className="px-3 py-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
              {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{profile?.full_name ?? 'User'}</p>
            <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {t('logout')}
        </button>
      </div>
    </aside>
  )
}
