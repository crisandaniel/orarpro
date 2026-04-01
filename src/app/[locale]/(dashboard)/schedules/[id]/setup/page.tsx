// src/app/[locale]/(dashboard)/schedules/[id]/setup/page.tsx
// Wizard vechi (pasul 2) — înlocuit cu business-setup.

import { redirect } from 'next/navigation'

interface Props { params: Promise<{ id: string; locale: string }> }

export default async function SetupRedirect({ params }: Props) {
  const { id, locale } = await params
  const lp = locale === 'ro' ? '' : `/${locale}`
  redirect(`${lp}/schedules/${id}/business-setup`)
}
