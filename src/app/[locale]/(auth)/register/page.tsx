'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

const registerSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string(),
  gdprConsent: z.boolean().refine((v) => v === true, {
    message: 'You must accept the terms to continue',
  }),
  marketingConsent: z.boolean().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const t = useTranslations('auth')
  const tErrors = useTranslations('errors')
  const router = useRouter()
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { gdprConsent: false, marketingConsent: false },
  })

  async function onSubmit(data: RegisterForm) {
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      toast.error(error.message)
      return
    }

    // Update GDPR consent in profile
    // This is handled via the handle_new_user trigger + a follow-up call
    await supabase
      .from('profiles')
      .update({
        gdpr_consent_at: new Date().toISOString(),
        terms_accepted_at: new Date().toISOString(),
        marketing_consent: data.marketingConsent ?? false,
      })
      .eq('email', data.email)

    toast.success('Account created! Please check your email to confirm.')
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600">OrarPro</h1>
          <p className="text-gray-500 mt-2 text-sm">14 days free trial, no credit card required</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
          <h2 className="text-xl font-semibold mb-6">{t('register')}</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('fullName')}</label>
              <input
                {...register('fullName')}
                type="text"
                autoComplete="name"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Ion Popescu"
              />
              {errors.fullName && (
                <p className="text-red-500 text-xs mt-1">{errors.fullName.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">{t('email')}</label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">{t('password')}</label>
              <input
                {...register('password')}
                type="password"
                autoComplete="new-password"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">{t('confirmPassword')}</label>
              <input
                {...register('confirmPassword')}
                type="password"
                autoComplete="new-password"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* GDPR Consent — separate checkboxes, not pre-checked */}
            <div className="pt-2 space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  {...register('gdprConsent')}
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Sunt de acord cu{' '}
                  <Link href="/terms" className="text-indigo-600 hover:underline" target="_blank">
                    Termenii și Condițiile
                  </Link>{' '}
                  și{' '}
                  <Link href="/privacy" className="text-indigo-600 hover:underline" target="_blank">
                    Politica de Confidențialitate
                  </Link>
                  {' '}*
                </span>
              </label>
              {errors.gdprConsent && (
                <p className="text-red-500 text-xs ml-7">{errors.gdprConsent.message}</p>
              )}

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  {...register('marketingConsent')}
                  type="checkbox"
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Vreau să primesc noutăți și sfaturi despre OrarPro (opțional)
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Creează cont gratuit
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            {t('hasAccount')}{' '}
            <Link href="/login" className="text-indigo-600 font-medium hover:underline">
              {t('login')}
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
