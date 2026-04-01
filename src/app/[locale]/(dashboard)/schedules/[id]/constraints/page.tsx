// src/app/[locale]/(dashboard)/schedules/[id]/constraints/page.tsx
// Wizard vechi (pasul 3) — înlocuit cu business-setup tab Constrângeri.

import { redirect } from 'next/navigation'

interface Props { params: Promise<{ id: string; locale: string }> }

export default async function ConstraintsRedirect({ params }: Props) {
  const { id, locale } = await params
  const lp = locale === 'ro' ? '' : `/${locale}`
  redirect(`${lp}/schedules/${id}/business-setup`)
}
