'use client'

// Login page — email/password form + Google OAuth button.
// On success: redirects to /dashboard (or ?redirectTo= param).
// Used by: unauthenticated users; middleware redirects here for protected routes.



import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Calendar, Bot, CheckCircle } from 'lucide-react'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})
type LoginForm = z.infer<typeof loginSchema>

const i18n = {
  ro: {
    title: 'Bun venit înapoi',
    subtitle: 'Autentifică-te pentru a accesa orarul echipei tale',
    google: 'Continuă cu Google',
    or: 'sau cu email',
    email: 'Adresă email',
    password: 'Parolă',
    forgot: 'Ai uitat parola?',
    submit: 'Autentificare',
    noAccount: 'Nu ai cont?',
    register: 'Înregistrează-te gratuit',
    trial: '14 zile gratuit, fără card bancar',
    features: [
      { title: 'Generare automată', desc: 'Algoritm care creează orare complete respectând toate constrângerile.' },
      { title: 'Analiză AI', desc: 'Sugestii pentru echilibrarea turelor și prevenirea burnout-ului.' },
      { title: 'Sărbători legale', desc: 'Detectare automată pentru România și 100+ țări.' },
    ],
  },
  en: {
    title: 'Welcome back',
    subtitle: 'Sign in to access your team schedule',
    google: 'Continue with Google',
    or: 'or with email',
    email: 'Email address',
    password: 'Password',
    forgot: 'Forgot password?',
    submit: 'Sign in',
    noAccount: "Don't have an account?",
    register: 'Sign up for free',
    trial: '14-day free trial, no credit card',
    features: [
      { title: 'Auto generation', desc: 'Algorithm that creates complete schedules respecting all constraints.' },
      { title: 'AI analysis', desc: 'Suggestions for balancing shifts and preventing burnout.' },
      { title: 'Public holidays', desc: 'Automatic detection for 100+ countries.' },
    ],
  },
}

export default function LoginPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const locale = pathname.split('/')[1] === 'en' ? 'en' : 'ro'
  const t = i18n[locale]
  const redirectTo = searchParams.get('redirectTo') ?? `/${locale}/dashboard`
  const [showPassword, setShowPassword] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginForm) {
    const { error } = await supabase.auth.signInWithPassword(data)
    if (error) { toast.error(error.message); return }
    window.location.href = redirectTo
  }

  async function loginWithGoogle() {
    setLoadingGoogle(true)
    const callbackUrl = `${window.location.origin}/${locale}/auth/callback?redirectTo=${encodeURIComponent(`/${locale}/dashboard`)}`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl, queryParams: { access_type: 'offline', prompt: 'consent' } },
    })
    if (error) { toast.error(error.message); setLoadingGoogle(false) }
  }

  const featureIcons = [Calendar, Bot, CheckCircle]

  return (
    <div className="min-h-screen flex" style={{ background: '#f8f9fc' }}>
      <div className="flex flex-col w-full max-w-md bg-white px-10 py-12"
        style={{ borderRight: '0.5px solid #e5e7eb' }}>

        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#2563eb' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
            </svg>
          </div>
          <span className="text-lg font-medium" style={{ color: '#111827' }}>OrarPro</span>
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium mb-6 self-start"
          style={{ background: '#eff6ff', color: '#1d4ed8' }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#2563eb' }} />
          {t.trial}
        </div>

        <h2 className="text-2xl font-medium mb-1.5" style={{ color: '#111827' }}>{t.title}</h2>
        <p className="text-sm mb-8" style={{ color: '#6b7280' }}>{t.subtitle}</p>

        <button onClick={loginWithGoogle} disabled={loadingGoogle}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 mb-5"
          style={{ border: '0.5px solid #d1d5db', background: '#fff', color: '#374151' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
          onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>
          {loadingGoogle ? <Loader2 className="w-4 h-4 animate-spin" /> : (
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {t.google}
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px" style={{ background: '#e5e7eb' }} />
          <span className="text-xs" style={{ color: '#9ca3af' }}>{t.or}</span>
          <div className="flex-1 h-px" style={{ background: '#e5e7eb' }} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>{t.email}</label>
            <input {...register('email')} type="email" autoComplete="email"
              placeholder="ion@restaurant.ro"
              className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }} />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium" style={{ color: '#374151' }}>{t.password}</label>
              <Link href={`/${locale}/forgot-password`} className="text-xs" style={{ color: '#2563eb' }}>{t.forgot}</Link>
            </div>
            <div className="relative">
              <input {...register('password')} type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: '#2563eb' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#1d4ed8')}
            onMouseLeave={e => (e.currentTarget.style.background = '#2563eb')}>
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {t.submit}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: '#6b7280' }}>
          {t.noAccount}{' '}
          <Link href={`/${locale}/register`} className="font-medium" style={{ color: '#2563eb' }}>{t.register}</Link>
        </p>
      </div>

      <div className="hidden md:flex flex-1 flex-col items-center justify-center px-12 gap-5"
        style={{ background: '#f0f4ff' }}>
        <div className="text-center mb-2">
          <p className="text-sm font-medium mb-2" style={{ color: '#1d4ed8' }}>OrarPro</p>
          <h3 className="text-2xl font-medium leading-snug" style={{ color: '#111827' }}>
            {locale === 'ro' ? 'Orare generate în câteva secunde' : 'Schedules generated in seconds'}
          </h3>
        </div>
        {t.features.map(({ title, desc }, i) => {
          const Icon = featureIcons[i]
          return (
            <div key={title} className="w-full max-w-xs rounded-xl px-5 py-4"
              style={{ background: '#fff', border: '0.5px solid #dbeafe' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: '#eff6ff' }}>
                <Icon className="w-4 h-4" style={{ color: '#2563eb' }} />
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: '#111827' }}>{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>{desc}</p>
            </div>
          )
        })}
      {/* Legal links */}
      <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '16px' }}>
        Prin autentificare, ești de acord cu{' '}
        <a href={`/${locale}/terms`} style={{ color: '#6b7280', textDecoration: 'underline' }}>Termenii și condițiile</a>
        {' '}și{' '}
        <a href={`/${locale}/privacy`} style={{ color: '#6b7280', textDecoration: 'underline' }}>Politica de confidențialitate</a>.
      </p>
      </div>
    </div>
  )
}