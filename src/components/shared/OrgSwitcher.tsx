'use client'

// OrgSwitcher — dropdown to switch between organizations.
// Receives OrgContextData (already loaded server-side in layout).
// No client-side fetching needed.

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Plus, Check, Building2, School } from 'lucide-react'
import type { OrgContextData, Organization } from '@/types'

interface Props {
  ctx: OrgContextData
  locale: string
}

function OrgIcon({ type }: { type: string }) {
  return type === 'education'
    ? <School style={{ width: '12px', height: '12px', color: '#7c3aed' }} />
    : <Building2 style={{ width: '12px', height: '12px', color: '#2563eb' }} />
}

export function OrgSwitcher({ ctx, locale }: Props) {
  const { org, allOrgs } = ctx
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function switchOrg(orgId: string) {
    if (orgId === org.id) { setOpen(false); return }
    await fetch('/api/organizations/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: orgId }),
    })
    window.location.href = `/${locale}/dashboard`
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '8px 10px', borderRadius: '8px', border: 'none',
          background: open ? '#f3f4f6' : 'transparent', cursor: 'pointer',
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '6px', flexShrink: 0,
            background: org.org_type === 'education' ? '#ede9fe' : '#eff6ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <OrgIcon type={org.org_type} />
          </div>
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '116px' }}>
              {org.name}
            </div>
            <div style={{ fontSize: '10px', color: '#9ca3af' }}>{org.plan}</div>
          </div>
        </div>
        <ChevronDown style={{ width: '14px', height: '14px', color: '#9ca3af', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: '#fff', border: '0.5px solid #e5e7eb', borderRadius: '10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 100, overflow: 'hidden',
        }}>
          {allOrgs.map(o => (
            <button key={o.id} onClick={() => switchOrg(o.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                width: '100%', padding: '8px 12px', border: 'none',
                background: o.id === org.id ? '#f9fafb' : 'none', cursor: 'pointer',
              }}
              onMouseEnter={e => { if (o.id !== org.id) (e.currentTarget as HTMLElement).style.background = '#f9fafb' }}
              onMouseLeave={e => { if (o.id !== org.id) (e.currentTarget as HTMLElement).style.background = 'none' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
                background: o.org_type === 'education' ? '#ede9fe' : '#eff6ff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <OrgIcon type={o.org_type} />
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: '12px', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.name}
                </div>
                <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                  {o.org_type === 'education' ? 'Educație' : 'Business'} · {o.plan}
                </div>
              </div>
              {o.id === org.id && <Check style={{ width: '14px', height: '14px', color: '#2563eb', flexShrink: 0 }} />}
            </button>
          ))}

          <div style={{ height: '0.5px', background: '#f3f4f6', margin: '4px 0' }} />

          <button
            onClick={() => { setOpen(false); window.location.href = `/${locale}/setup` }}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f9fafb'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>
            <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus style={{ width: '12px', height: '12px', color: '#2563eb' }} />
            </div>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#2563eb' }}>Adaugă organizație</span>
          </button>
        </div>
      )}
    </div>
  )
}
