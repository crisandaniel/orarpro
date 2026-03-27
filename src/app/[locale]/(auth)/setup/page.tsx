'use client'

// Organization setup page — shown after first login when user has no organization.
// Calls POST /api/organizations to create org + owner membership server-side.
// Dashboard layout redirects here automatically if org is missing.
// Used by: newly registered users.



import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const orgSchema = z.object({
  name: z.string().min(2, 'Numele organizației este obligatoriu'),
  country_code: z.string().min(2),
})

type OrgForm = z.infer<typeof orgSchema>

export default function SetupOrganizationPage() {
  const [done, setDone] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<OrgForm>({
    resolver: zodResolver(orgSchema),
    defaultValues: { country_code: 'RO' },
  })

  async function onSubmit(data: OrgForm) {
    const locale = window.location.pathname.split('/')[1] || 'ro'

    let res: Response
    try {
      res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } catch (err) {
      console.error('Fetch failed:', err)
      toast.error(`Eroare de conexiune: ${err instanceof Error ? err.message : String(err)}`)
      return
    }

    let result: any
    try {
      result = await res.json()
    } catch (err) {
      toast.error(`Răspuns invalid de la server (status: ${res.status})`)
      return
    }

    if (!res.ok) {
      toast.error(result.error ?? `Eroare server: ${res.status}`)
      return
    }

    toast.success('Organizație creată!')
    setDone(true)
    setTimeout(() => {
      window.location.href = `/${locale}/dashboard`
    }, 800)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#f8f9fc' }}>
      <div className="w-full max-w-md">

        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#2563eb' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
            </svg>
          </div>
          <span className="text-lg font-medium" style={{ color: '#111827' }}>OrarPro</span>
        </div>

        <div className="bg-white rounded-2xl px-8 py-8" style={{ border: '0.5px solid #e5e7eb' }}>
          <div className="mb-6">
            <h2 className="text-xl font-medium mb-1" style={{ color: '#111827' }}>Configurează organizația</h2>
            <p className="text-sm" style={{ color: '#6b7280' }}>Un singur pas rămas până la primul tău orar</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>
                Numele organizației
              </label>
              <input
                {...register('name')}
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }}
                placeholder="Restaurant Bella, Fabrica Nord, Liceul Teoretic..."
                disabled={done}
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>Țara</label>
              <select
                {...register('country_code')}
                disabled={done}
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }}
              >
                <option value="RO">România</option>
                <option value="DE">Germania</option>
                <option value="FR">Franța</option>
                <option value="ES">Spania</option>
                <option value="IT">Italia</option>
                <option value="GB">Regatul Unit</option>
                <option value="PL">Polonia</option>
                <option value="HU">Ungaria</option>
                <option value="BG">Bulgaria</option>
                <option value="US">Statele Unite</option>
              </select>
              <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
                Folosit pentru detectarea automată a sărbătorilor legale
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || done}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
              style={{ background: '#2563eb' }}
            >
              {(isSubmitting || done) && <Loader2 className="w-4 h-4 animate-spin" />}
              {done ? 'Se deschide dashboard-ul...' : 'Continuă spre dashboard'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
