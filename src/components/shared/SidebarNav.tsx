'use client'

// SidebarNav — main navigation sidebar.
// Receives OrgContextData from dashboard layout (server-side loaded).
// Dynamic menu: business → Angajați, education → Resurse.

import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard, Calendar, Users, Settings,
  LogOut, MessageSquare, School,
} from 'lucide-react'
import { OrgSwitcher } from '@/components/shared/OrgSwitcher'
import type { OrgContextData } from '@/types'

interface Props {
  ctx: OrgContextData
  locale: string
}

export function SidebarNav({ ctx, locale }: Props) {
  const t = useTranslations('nav')
  const pathname = usePathname()
  const { org } = ctx
  const isEducation = org.org_type === 'education'

  const links = [
    { href: `/${locale}/dashboard`,  label: t('dashboard'), icon: LayoutDashboard },
    { href: `/${locale}/schedules`,  label: t('schedules'), icon: Calendar },
    isEducation
      ? { href: `/${locale}/resources`, label: t('resources'), icon: School }
      : { href: `/${locale}/employees`, label: t('employees'), icon: Users },
    { href: `/${locale}/settings`,   label: t('settings'),  icon: Settings },
    { href: `/${locale}/feedback`,   label: t('contact'),   icon: MessageSquare },
  ]

  function handleLogout() {
    window.location.href = `/api/auth/logout?locale=${locale}`
  }

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

      {/* Org switcher */}
      <div className="px-3 py-2" style={{ borderBottom: '0.5px solid #f3f4f6' }}>
        <OrgSwitcher ctx={ctx} locale={locale} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <a key={href} href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: isActive ? '#eff6ff' : 'transparent',
                color: isActive ? '#1d4ed8' : '#6b7280',
              }}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </a>
          )
        })}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-3" style={{ borderTop: '0.5px solid #f3f4f6' }}>
        <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0"
            style={{ background: '#6366f1' }}>
            {ctx.profile.full_name?.[0] ?? ctx.profile.email?.[0] ?? '?'}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: '#111827' }}>
              {ctx.profile.full_name ?? ctx.profile.email}
            </p>
            <p className="text-xs truncate" style={{ color: '#9ca3af' }}>
              {ctx.role}
            </p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm w-full transition-colors hover:bg-gray-50"
          style={{ color: '#6b7280', border: 'none', background: 'none', cursor: 'pointer' }}>
          <LogOut className="w-4 h-4 shrink-0" />
          Deconectare
        </button>
      </div>
    </aside>
  )
}
