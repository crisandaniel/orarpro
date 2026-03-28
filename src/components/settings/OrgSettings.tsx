'use client'

// OrgSettings — editable organization name and type.
// Used in the Settings page for owner/admin users.

import { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Factory, GraduationCap, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  org: { id: string; name: string; org_type: string }
  role: string
}

export function OrgSettings({ org, role }: Props) {
  const router = useRouter()
  const params = useParams()
  const locale = params.locale as string ?? 'ro'
  const [name, setName]       = useState(org.name)
  const [orgType, setOrgType] = useState<'business' | 'education'>(
    (org.org_type as any) ?? 'business'
  )
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [showDelete, setShowDelete]   = useState(false)
  const canEdit = ['owner', 'admin'].includes(role)
  console.log('[OrgSettings] role:', role, 'canEdit:', canEdit)

  async function deleteOrg() {
    if (confirmName !== org.name) return
    setDeleting(true)
    const res = await fetch(`/api/organizations/${org.id}`, { method: 'DELETE' })
    const result = await res.json()
    setDeleting(false)
    if (!res.ok) { toast.error(result.error ?? 'Eroare'); return }
    toast.success('Organizație ștearsă')
    // Redirect to dashboard — layout will handle no-org case
    setTimeout(() => { router.push(`/${locale}/dashboard`) }, 500)
  }

  async function save() {
    if (!canEdit) return
    setSaving(true)
    const res = await fetch(`/api/organizations/${org.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, org_type: orgType }),
    })
    const result = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(result.error ?? 'Eroare'); return }
    toast.success('Organizație actualizată')
    // Reload to update sidebar
    router.refresh()
  }

  const inp: React.CSSProperties = {
    border: '0.5px solid #d1d5db', color: '#111827', background: canEdit ? '#fff' : '#f9fafb',
    borderRadius: '8px', padding: '8px 12px', fontSize: '14px', width: '100%',
    boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Name */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
          Numele organizației
        </label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={!canEdit}
          style={inp}
          placeholder="Numele organizației"
        />
      </div>

      {/* Type */}
      <div>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
          Tipul organizației
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {([
            { value: 'business'  as const, icon: Factory,       title: 'Business',  desc: 'HoReCa, fabrici, retail, clinici' },
            { value: 'education' as const, icon: GraduationCap, title: 'Educație',  desc: 'Școli, licee, grădinițe, universități' },
          ]).map(({ value, icon: Icon, title, desc }) => (
            <label key={value}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '12px', borderRadius: '10px', cursor: canEdit ? 'pointer' : 'default',
                border: `2px solid ${orgType === value ? '#2563eb' : '#e5e7eb'}`,
                background: orgType === value ? '#eff6ff' : '#fff',
                opacity: !canEdit ? 0.7 : 1,
              }}>
              <input type="radio" value={value} checked={orgType === value}
                onChange={() => canEdit && setOrgType(value)}
                style={{ display: 'none' }} />
              <Icon style={{ width: '18px', height: '18px', marginTop: '1px', flexShrink: 0, color: orgType === value ? '#2563eb' : '#9ca3af' }} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 500, color: orgType === value ? '#1d4ed8' : '#111827', marginBottom: '2px' }}>{title}</p>
                <p style={{ fontSize: '11px', color: '#9ca3af' }}>{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {canEdit && (
        <button onClick={save} disabled={saving}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start',
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            background: '#2563eb', color: '#fff', fontSize: '13px', fontWeight: 500,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          }}>
          {saving ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : <Check style={{ width: '14px', height: '14px' }} />}
          Salvează
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
        </button>
      )}

      {!canEdit && (
        <p style={{ fontSize: '12px', color: '#9ca3af' }}>
          Doar proprietarul sau administratorul poate edita organizația.
        </p>
      )}

      {/* Delete org — only for owner */}
      {(role === 'owner' || role === 'admin') && (
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '0.5px solid #fee2e2' }}>
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)}
              style={{ fontSize: '13px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Șterge organizația...
            </button>
          ) : (
            <div style={{ background: '#fff5f5', border: '0.5px solid #fecaca', borderRadius: '10px', padding: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#dc2626', marginBottom: '4px' }}>
                Șterge organizația permanentă
              </p>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
                Aceasta va șterge toate orarele, angajații, constrângerile și toate datele asociate. Acțiunea este ireversibilă.
              </p>
              <p style={{ fontSize: '12px', color: '#374151', marginBottom: '6px' }}>
                Scrie <strong>{org.name}</strong> pentru a confirma:
              </p>
              <input
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                placeholder={org.name}
                style={{ border: '0.5px solid #fca5a5', color: '#111827', background: '#fff', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', width: '100%', boxSizing: 'border-box', marginBottom: '10px' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={deleteOrg}
                  disabled={confirmName !== org.name || deleting}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: confirmName !== org.name || deleting ? 'not-allowed' : 'pointer', opacity: confirmName !== org.name || deleting ? 0.5 : 1 }}>
                  {deleting ? <Loader2 style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} /> : null}
                  Șterge definitiv
                </button>
                <button onClick={() => { setShowDelete(false); setConfirmName('') }}
                  style={{ padding: '7px 14px', borderRadius: '8px', border: '0.5px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>
                  Anulează
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}