'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

const orgSchema = z.object({
  name: z.string().min(2, 'Organization name is required'),
  country_code: z.string().min(2),
})

type OrgForm = z.infer<typeof orgSchema>

export default function SetupOrganizationPage() {
  const router = useRouter()
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<OrgForm>({
    resolver: zodResolver(orgSchema),
    defaultValues: { country_code: 'RO' },
  })

  async function onSubmit(data: OrgForm) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: data.name, country_code: data.country_code })
      .select()
      .single()

    if (orgError || !org) {
      toast.error('Failed to create organization')
      return
    }

    // Add user as owner
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: 'owner',
        accepted_at: new Date().toISOString(),
      })

    if (memberError) {
      toast.error('Failed to set up membership')
      return
    }

    toast.success('Organization created!')
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-indigo-600">OrarPro</h1>
          <p className="text-gray-500 mt-2">One last step — set up your organization</p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1.5">Organization name</label>
              <input
                {...register('name')}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Restaurant Bella, Fabrica Nord, Liceul Teoretic..."
              />
              {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Country</label>
              <select
                {...register('country_code')}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="RO">Romania</option>
                <option value="DE">Germany</option>
                <option value="FR">France</option>
                <option value="ES">Spain</option>
                <option value="IT">Italy</option>
                <option value="GB">United Kingdom</option>
                <option value="PL">Poland</option>
                <option value="HU">Hungary</option>
                <option value="BG">Bulgaria</option>
                <option value="US">United States</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Used for public holiday detection</p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Continue to dashboard
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
