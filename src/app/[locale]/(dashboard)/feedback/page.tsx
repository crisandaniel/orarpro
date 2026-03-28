'use client'

// Contact page — early access / feedback form.
// Replaces billing in the nav during beta.
// Saves to contact_requests table in Supabase.

import { useParams } from 'next/navigation'
import { useState } from 'react'
import { Sparkles, Users, Calendar, Zap, CheckCircle, ArrowRight, Loader2, MessageSquare } from 'lucide-react'

const FEATURES_COMING = [
  { icon: Users,         label: 'Angajați nelimitați',   desc: 'Scalează fără restricții, oricâte locații' },
  { icon: Calendar,      label: 'Orar școlar',           desc: 'Generare automată: profesori, clase, săli' },
  { icon: Zap,           label: 'Export Excel & PDF',    desc: 'Descarcă orarul în orice format' },
  { icon: MessageSquare, label: 'Notificări angajați',   desc: 'Email automat când orarul e publicat' },
]

export default function ContactPage() {
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent]       = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      })
    } catch { /* ignore */ }
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="max-w-2xl mx-auto py-4">

      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
          style={{ background: '#eff6ff', color: '#2563eb', border: '0.5px solid #bfdbfe' }}>
          <Sparkles className="w-3 h-3" />
          Versiune beta — acces gratuit
        </div>
        <h1 className="text-2xl font-medium mb-3" style={{ color: '#111827' }}>
          Ai nevoie de mai mult?
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: '#6b7280', maxWidth: '480px', margin: '0 auto' }}>
          Suntem o echipă mică la început de drum și construim OrarPro ascultând
          fiecare utilizator. Dacă ai nevoie de mai mulți angajați, funcționalități
          avansate sau integrări specifice — lasă-ne un mesaj și te contactăm personal.
        </p>
      </div>

      {/* Current status */}
      <div className="rounded-xl p-5 mb-8 flex items-center gap-4"
        style={{ background: '#f0fdf4', border: '0.5px solid #bbf7d0' }}>
        <CheckCircle className="w-5 h-5 shrink-0" style={{ color: '#059669' }} />
        <div>
          <p className="text-sm font-medium" style={{ color: '#111827' }}>
            Acces complet gratuit în perioada beta
          </p>
          <p className="text-xs mt-0.5" style={{ color: '#059669' }}>
            Toate funcționalitățile sunt disponibile fără restricții până la lansarea oficială.
          </p>
        </div>
      </div>

      {/* Coming soon */}
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wide mb-4" style={{ color: '#9ca3af' }}>
          Ce pregătim
        </p>
        <div className="grid grid-cols-2 gap-3">
          {FEATURES_COMING.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-xl p-4"
              style={{ background: '#fff', border: '0.5px solid #e5e7eb' }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-4 h-4" style={{ color: '#2563eb' }} />
                <span className="text-sm font-medium" style={{ color: '#111827' }}>{label}</span>
              </div>
              <p className="text-xs" style={{ color: '#9ca3af' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="rounded-xl p-6" style={{ background: '#fff', border: '0.5px solid #e5e7eb' }}>
        {sent ? (
          <div className="text-center py-6">
            <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: '#059669' }} />
            <p className="text-sm font-medium mb-1" style={{ color: '#111827' }}>
              Mulțumim! Am primit mesajul tău.
            </p>
            <p className="text-xs" style={{ color: '#6b7280' }}>
              Te vom contacta în cel mai scurt timp posibil.
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-sm font-medium mb-1" style={{ color: '#111827' }}>
              Spune-ne ce ai nevoie
            </h2>
            <p className="text-xs mb-5" style={{ color: '#9ca3af' }}>
              Fiecare cerere ne ajută să prioritizăm ce construim în continuare.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Nume</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Ion Popescu"
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                    Email <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="ion@restaurant.ro" required
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  De ce ai nevoie?
                </label>
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Ex: Avem 3 restaurante cu câte 40 de angajați și am nevoie de export Excel și notificări automate..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{ border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }} />
              </div>
              <button type="submit" disabled={loading || !email}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                style={{ background: '#2563eb' }}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Trimite
              </button>
            </form>
          </>
        )}
      </div>

      <p className="text-xs text-center mt-6" style={{ color: '#d1d5db' }}>
        Nu colectăm date fără consimțământ. Emailul tău va fi folosit exclusiv pentru a te contacta.
      </p>
    </div>
  )
}