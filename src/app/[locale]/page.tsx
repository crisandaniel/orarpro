// Landing / index page for each locale (/ro, /en).
// Shows public marketing page if not logged in, redirects to /dashboard if logged in.
// Used by: visitors arriving at the root of a locale.

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Users, Bot, CheckCircle, Clock, Shield } from 'lucide-react'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Generator de Orar',
  description: 'Creează orarul echipei tale automat. Pentru restaurante, fabrici, scoli. Defineste echipa, constrangerile si genereaza orarul.',
  alternates: { canonical: '/ro' },
}

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect(`/${locale}/dashboard`)

  const features = [
    { icon: Clock, title: 'Generare în secunde', desc: 'Algoritm care creează orare complete respectând toate constrângerile setate de tine.' },
    { icon: Bot, title: 'Analiză AI', desc: 'Claude AI analizează orarul și oferă sugestii pentru echilibrarea turelor și prevenirea burnout-ului.' },
    { icon: CheckCircle, title: 'Sărbători legale', desc: 'Detectare automată pentru România și 100+ țări. Nicio zi liberă omisă.' },
    { icon: Users, title: 'Constrângeri avansate', desc: 'Pauze minime, ture consecutive, perechi de angajați, concedii — totul respectat automat.' },
    { icon: Calendar, title: 'HoReCa, fabrici, școli', desc: 'Orar de ture pentru restaurante și fabrici, orar clasic pentru instituții de învățământ.' },
    { icon: Shield, title: 'GDPR compliant', desc: 'Datele echipei tale sunt izolate și protejate. Export și ștergere oricând.' },
  ]

  const plans = [
    { name: 'Free', price: '0', period: '', employees: '10 angajați', features: ['Orare nelimitate', 'Constrângeri hard', 'Sărbători legale'], cta: 'Începe gratuit', primary: false },
    { name: 'Starter', price: '29', period: '/lună', employees: '25 angajați', features: ['Tot din Free', 'Sugestii AI', 'Export PDF'], cta: '14 zile gratuit', primary: true },
    { name: 'Pro', price: '69', period: '/lună', employees: '75 angajați', features: ['Tot din Starter', 'Locații multiple', 'Suport prioritar'], cta: '14 zile gratuit', primary: false },
  ]

  return (
    <div style={{ background: '#fff', fontFamily: 'var(--font-sans)' }}>

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#2563eb' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
            </svg>
          </div>
          <span className="text-base font-medium" style={{ color: '#111827' }}>OrarPro</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/${locale}/login`} className="text-sm px-4 py-2 rounded-lg transition-colors"
            style={{ color: '#6b7280' }}>
            Sign in
          </Link>
          <Link href={`/${locale}/register`}
            className="text-sm px-4 py-2.5 rounded-lg font-medium text-white"
            style={{ background: '#2563eb' }}>
            Începe gratuit
          </Link>
          <a href={`/${locale}/contact`} style={{ color: '#2563eb' }}>Contact</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-8 py-20 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
          style={{ background: '#eff6ff', color: '#1d4ed8' }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#2563eb' }} />
          Free tier permanent — până la 10 angajați
        </div>
        <h1 className="text-5xl font-medium leading-tight mb-5" style={{ color: '#111827' }}>
          Orare de echipă<br />
          <span style={{ color: '#2563eb' }}>generate automat</span>
        </h1>
        <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: '#6b7280', lineHeight: 1.6 }}>
          Pentru restaurante, fabrici, clinici și școli. Definești echipa și constrângerile — noi generăm orarul în câteva secunde.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href={`/${locale}/register`}
            className="px-6 py-3 rounded-lg font-medium text-white text-sm"
            style={{ background: '#2563eb' }}>
            Creează cont gratuit
          </Link>
          <Link href={`/${locale}/login`}
            className="px-6 py-3 rounded-lg text-sm font-medium"
            style={{ border: '0.5px solid #d1d5db', color: '#374151' }}>
            Am deja cont
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-medium mb-2" style={{ color: '#111827' }}>Tot ce ai nevoie</h2>
          <p className="text-sm" style={{ color: '#6b7280' }}>Fără foi Excel, fără conflicte de ture, fără calcule manuale</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl p-5" style={{ border: '0.5px solid #e5e7eb' }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ background: '#eff6ff' }}>
                <Icon className="w-4 h-4" style={{ color: '#2563eb' }} />
              </div>
              <h3 className="text-sm font-medium mb-1.5" style={{ color: '#111827' }}>{title}</h3>
              <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      {/* <section className="max-w-4xl mx-auto px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-medium mb-2" style={{ color: '#111827' }}>Prețuri simple</h2>
          <p className="text-sm" style={{ color: '#6b7280' }}>Fără contracte. Anulezi oricând.</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {plans.map(({ name, price, period, employees, features: fs, cta, primary }) => (
            <div key={name} className="rounded-xl p-6"
              style={{
                border: primary ? '2px solid #2563eb' : '0.5px solid #e5e7eb',
                background: '#fff',
              }}>
              {primary && (
                <div className="inline-block px-2.5 py-1 rounded-full text-xs font-medium mb-3"
                  style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                  Popular
                </div>
              )}
              <h3 className="text-base font-medium mb-1" style={{ color: '#111827' }}>{name}</h3>
              <div className="flex items-baseline gap-0.5 mb-1">
                <span className="text-3xl font-medium" style={{ color: '#111827' }}>{price} RON</span>
                <span className="text-sm" style={{ color: '#9ca3af' }}>{period}</span>
              </div>
              <p className="text-xs mb-4" style={{ color: '#6b7280' }}>{employees}</p>
              <ul className="space-y-2 mb-5">
                {fs.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs" style={{ color: '#374151' }}>
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: '#059669' }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={`/${locale}/register`}
                className="block w-full text-center py-2.5 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: primary ? '#2563eb' : '#fff',
                  color: primary ? '#fff' : '#374151',
                  border: primary ? 'none' : '0.5px solid #d1d5db',
                }}>
                {cta}
              </Link>
            </div>
          ))}
        </div>
      </section> */}

      {/* Footer */}
      <footer className="border-t px-8 py-6 max-w-6xl mx-auto flex items-center justify-between"
        style={{ borderColor: '#f3f4f6' }}>
        <span className="text-xs" style={{ color: '#9ca3af' }}>© 2025 OrarPro</span>
        <div className="flex gap-4">
          <Link href="/privacy" className="text-xs" style={{ color: '#9ca3af' }}>Privacy</Link>
          <Link href="/terms" className="text-xs" style={{ color: '#9ca3af' }}>Terms</Link>
        </div>
      </footer>
    </div>
  )
}
