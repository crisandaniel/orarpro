'use client'

// Main navigation sidebar — shown on all dashboard pages.
// Contains: logo, org name + plan, nav links, language switcher (RO/EN), user info, logout.
// Language switcher does a hard redirect preserving the current path with new locale.
// Used by: (dashboard)/layout.tsx.



import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutDashboard, Calendar, Users, Settings, CreditCard, LogOut, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Organization } from '@/types'

interface SidebarNavProps {
  profile: Profile | null
  organization: Organization | null
}

export function SidebarNav({ profile, organization }: SidebarNavProps) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const supabase = createClient()
  const locale = pathname.split('/')[1] || 'ro'

  function handleLogout() {
    // Use server-side logout to properly clear SSR session cookies
    // Client-side signOut() alone doesn't work reliably on Vercel
    window.location.href = `/api/auth/logout?locale=${locale}`
  }

  const links = [
    { href: `/${locale}/dashboard`,  label: t('dashboard'), icon: LayoutDashboard },
    { href: `/${locale}/schedules`,  label: t('schedules'), icon: Calendar },
    { href: `/${locale}/employees`,  label: t('employees'), icon: Users },
    { href: `/${locale}/settings`,   label: t('settings'),  icon: Settings },
    { href: `/${locale}/billing`,    label: t('billing'),   icon: CreditCard },
  ]

  return (
    <aside className="w-56 flex flex-col shrink-0"
      style={{ background: '#fff', borderRight: '0.5px solid #e5e7eb' }}>

      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5"
        style={{ borderBottom: '0.5px solid #f3f4f6' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: '#2563eb' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
          </svg>
        </div>
        <span className="text-base font-medium" style={{ color: '#111827' }}>OrarPro</span>
      </div>

      {/* Organization */}
      {organization && (
        <div className="px-3 py-2" style={{ borderBottom: '0.5px solid #f3f4f6' }}>
          <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors hover:bg-gray-50">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#111827' }}>
                {organization.name}
              </p>
              <p className="text-xs capitalize" style={{ color: '#9ca3af' }}>
                {organization.plan} {t('plan')}
              </p>
            </div>
            <ChevronDown className="w-3.5 h-3.5 shrink-0 ml-1" style={{ color: '#9ca3af' }} />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: isActive ? '#eff6ff' : 'transparent',
                color: isActive ? '#1d4ed8' : '#6b7280',
                fontWeight: isActive ? 500 : 400,
              }}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Language switcher + user + logout */}
      <div className="px-3 py-3" style={{ borderTop: '0.5px solid #f3f4f6' }}>
        {/* Language */}
        <div className="flex items-center gap-1 px-3 py-1.5 mb-1">
          <span className="text-xs mr-1" style={{ color: '#9ca3af' }}>{t('language')}:</span>
          {['ro', 'en'].map((lang) => (
            <button
              key={lang}
              onClick={() => {
                const withoutLocale = pathname.replace(/^\/(ro|en)/, '') || '/'
                window.location.href = `/${lang}${withoutLocale}`
              }}
              className="px-2 py-0.5 rounded text-xs font-medium transition-colors"
              style={{
                background: locale === lang ? '#eff6ff' : 'transparent',
                color: locale === lang ? '#1d4ed8' : '#9ca3af',
              }}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Profile */}
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-medium"
            style={{ background: '#eff6ff', color: '#1d4ed8' }}>
            {profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate" style={{ color: '#111827' }}>
              {profile?.full_name ?? 'User'}
            </p>
            <p className="text-xs truncate" style={{ color: '#9ca3af' }}>{profile?.email}</p>
          </div>
        </div>

        {/* Logout */}
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-50"
          style={{ color: '#6b7280' }}>
          <LogOut className="w-4 h-4" />
          {t('logout')}
        </button>
      </div>
    </aside>
  )
}