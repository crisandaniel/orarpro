'use client'

// Client component for Generate, Publish, Delete, and Print/PDF buttons.
// Print opens a new tab with a clean print-ready version of the schedule.
// Used by: schedules/[id]/page.tsx.

import { useState } from 'react'
import { Loader2, Trash2, Printer } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  scheduleId: string
  status: string
  locale: string
}

export function ScheduleActions({ scheduleId, status, locale }: Props) {
  const [loading, setLoading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/generate`, { method: 'POST' })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error ?? 'Generation failed'); return }
      toast.success(`${result.stats?.filledSlots ?? 0} asignări create.`)
      window.location.reload()
    } catch { toast.error('Eroare de rețea') }
    finally { setLoading(false) }
  }

  async function handlePublish() {
    setLoading(true)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/publish`, { method: 'POST' })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error ?? 'Publish failed'); return }
      toast.success('Orar publicat!')
      window.location.reload()
    } catch { toast.error('Eroare de rețea') }
    finally { setLoading(false) }
  }

  async function handleDelete() {
    setLoading(true)
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/delete`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) { toast.error(result.error ?? 'Delete failed'); return }
      toast.success('Orar șters.')
      window.location.href = `/${locale}/schedules`
    } catch { toast.error('Eroare de rețea') }
    finally { setLoading(false) }
  }

  function handlePrint() {
    window.print()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

      {status === 'draft' && (
        <>
          <a href={`/${locale}/schedules/${scheduleId}/setup`}
            className="px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ border: '0.5px solid #e5e7eb', color: '#374151', background: '#fff' }}>
            Editează ture
          </a>
          <a href={`/${locale}/schedules/${scheduleId}/constraints`}
            className="px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ border: '0.5px solid #e5e7eb', color: '#374151', background: '#fff' }}>
            Constrângeri
          </a>
          <button onClick={handleGenerate} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: '#2563eb' }}>
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Generează
          </button>
        </>
      )}

      {status === 'generated' && (
        <button onClick={handlePublish} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ background: '#059669' }}>
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Publică
        </button>
      )}

      {status === 'published' && (
        <span className="px-2.5 py-1 rounded-full text-xs font-medium"
          style={{ background: '#f0fdf4', color: '#166534' }}>
          Publicat
        </span>
      )}

      {/* Print / PDF */}
      <button onClick={handlePrint}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
        style={{ border: '0.5px solid #e5e7eb', color: '#374151', background: '#fff' }}>
        <Printer className="w-3.5 h-3.5" />
        Print / PDF
      </button>

      {/* Delete with confirm */}
      {!confirmDelete ? (
        <button onClick={() => setConfirmDelete(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
          style={{ border: '0.5px solid #fecaca', color: '#dc2626', background: '#fff' }}>
          <Trash2 className="w-3.5 h-3.5" />
          Șterge
        </button>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: '#fef2f2', border: '0.5px solid #fecaca' }}>
          <span className="text-xs" style={{ color: '#dc2626' }}>Ești sigur?</span>
          <button onClick={handleDelete} disabled={loading}
            className="px-2 py-1 rounded text-xs font-medium text-white"
            style={{ background: '#dc2626' }}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Da, șterge'}
          </button>
          <button onClick={() => setConfirmDelete(false)}
            className="px-2 py-1 rounded text-xs"
            style={{ color: '#6b7280' }}>
            Anulează
          </button>
        </div>
      )}
    </div>
  )
}
