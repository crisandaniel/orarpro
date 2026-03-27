'use client'

// Register page — creates a new Supabase account with GDPR consent.
// If email confirmation disabled: redirects to /setup.
// If enabled: shows 'check your email' screen.
// Used by: new users.



import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string(),
  gdprConsent: z.boolean().refine((v) => v === true, { message: 'Required' }),
  marketingConsent: z.boolean().optional(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type RegisterForm = z.infer<typeof registerSchema>

const i18n = {
  ro: {
    title: 'Creează cont gratuit',
    subtitle: '14 zile trial, fără card bancar',
    fullName: 'Nume complet',
    email: 'Adresă email',
    password: 'Parolă',
    confirmPassword: 'Confirmă parola',
    gdpr: 'Sunt de acord cu',
    terms: 'Termenii',
    and: 'și',
    privacy: 'Politica de Confidențialitate',
    marketing: 'Vreau să primesc noutăți despre OrarPro (opțional)',
    submit: 'Creează cont gratuit',
    hasAccount: 'Ai deja cont?',
    login: 'Autentifică-te',
    confirmTitle: 'Verifică emailul',
    confirmText: 'Am trimis un link de confirmare la adresa ta. Dă click pe link pentru a activa contul.',
    backToLogin: 'Înapoi la autentificare',
    gdprRequired: 'Trebuie să accepți termenii pentru a continua',
    passwordMismatch: 'Parolele nu coincid',
  },
  en: {
    title: 'Create free account',
    subtitle: '14-day trial, no credit card',
    fullName: 'Full name',
    email: 'Email address',
    password: 'Password',
    confirmPassword: 'Confirm password',
    gdpr: 'I agree to the',
    terms: 'Terms',
    and: 'and',
    privacy: 'Privacy Policy',
    marketing: 'I want to receive news about OrarPro (optional)',
    submit: 'Create free account',
    hasAccount: 'Already have an account?',
    login: 'Sign in',
    confirmTitle: 'Check your email',
    confirmText: 'We sent a confirmation link to your address. Click the link to activate your account.',
    backToLogin: 'Back to sign in',
    gdprRequired: 'You must accept the terms to continue',
    passwordMismatch: 'Passwords do not match',
  },
}

export default function RegisterPage() {
  const pathname = usePathname()
  const locale = pathname.split('/')[1] === 'en' ? 'en' : 'ro'
  const t = i18n[locale]
  const [confirmationSent, setConfirmationSent] = useState(false)
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(z.object({
      fullName: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(8),
      confirmPassword: z.string(),
      gdprConsent: z.boolean().refine((v) => v === true, { message: t.gdprRequired }),
      marketingConsent: z.boolean().optional(),
    }).refine((d) => d.password === d.confirmPassword, {
      message: t.passwordMismatch,
      path: ['confirmPassword'],
    })),
    defaultValues: { gdprConsent: false, marketingConsent: false },
  })

  async function onSubmit(data: RegisterForm) {
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.fullName },
        emailRedirectTo: `${window.location.origin}/${locale}/auth/callback`,
      },
    })
    if (error) { toast.error(error.message); return }

    await supabase.from('profiles').update({
      gdpr_consent_at: new Date().toISOString(),
      terms_accepted_at: new Date().toISOString(),
      marketing_consent: data.marketingConsent ?? false,
    }).eq('email', data.email)

    if (signUpData.session) {
      window.location.href = `/${locale}/setup`
      return
    }
    setConfirmationSent(true)
  }

  const inputStyle = { border: '0.5px solid #d1d5db', color: '#111827', background: '#fff' }

  if (confirmationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#f8f9fc' }}>
        <div className="w-full max-w-md text-center">
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#2563eb' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
              </svg>
            </div>
            <span className="text-lg font-medium" style={{ color: '#111827' }}>OrarPro</span>
          </div>
          <div className="bg-white rounded-2xl px-8 py-10" style={{ border: '0.5px solid #e5e7eb' }}>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#eff6ff' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </div>
            <h2 className="text-xl font-medium mb-2" style={{ color: '#111827' }}>{t.confirmTitle}</h2>
            <p className="text-sm mb-6" style={{ color: '#6b7280', lineHeight: 1.6 }}>{t.confirmText}</p>
            <Link href={`/${locale}/login`} className="text-sm font-medium" style={{ color: '#2563eb' }}>
              {t.backToLogin}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: '#f8f9fc' }}>
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
            <h2 className="text-xl font-medium mb-1" style={{ color: '#111827' }}>{t.title}</h2>
            <p className="text-sm" style={{ color: '#6b7280' }}>{t.subtitle}</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>{t.fullName}</label>
              <input {...register('fullName')} type="text" autoComplete="name"
                placeholder="Ion Popescu"
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={inputStyle} />
              {errors.fullName && <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>{t.email}</label>
              <input {...register('email')} type="email" autoComplete="email"
                placeholder="ion@restaurant.ro"
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={inputStyle} />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>{t.password}</label>
                <input {...register('password')} type="password" autoComplete="new-password"
                  className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={inputStyle} />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#374151' }}>{t.confirmPassword}</label>
                <input {...register('confirmPassword')} type="password" autoComplete="new-password"
                  className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={inputStyle} />
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>}
              </div>
            </div>

            <div className="pt-1 space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input {...register('gdprConsent')} type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                <span className="text-sm" style={{ color: '#6b7280' }}>
                  {t.gdpr}{' '}
                  <Link href={`/${locale}/terms`} className="underline" style={{ color: '#2563eb' }} target="_blank">{t.terms}</Link>
                  {' '}{t.and}{' '}
                  <Link href={`/${locale}/privacy`} className="underline" style={{ color: '#2563eb' }} target="_blank">{t.privacy}</Link>
                  {' '}*
                </span>
              </label>
              {errors.gdprConsent && <p className="text-red-500 text-xs ml-6">{errors.gdprConsent.message}</p>}

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input {...register('marketingConsent')} type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                <span className="text-sm" style={{ color: '#9ca3af' }}>{t.marketing}</span>
              </label>
            </div>

            <button type="submit" disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              style={{ background: '#2563eb' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1d4ed8')}
              onMouseLeave={e => (e.currentTarget.style.background = '#2563eb')}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {t.submit}
            </button>
          </form>

          <p className="text-center text-sm mt-5" style={{ color: '#6b7280' }}>
            {t.hasAccount}{' '}
            <Link href={`/${locale}/login`} className="font-medium" style={{ color: '#2563eb' }}>{t.login}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
