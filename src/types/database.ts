// Auto-generated types from Supabase schema
// Run: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          gdpr_consent_at: string | null
          terms_accepted_at: string | null
          marketing_consent: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      organizations: {
        Row: {
          id: string
          name: string
          country_code: string
          plan: 'free' | 'starter' | 'pro' | 'business'
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          stripe_price_id: string | null
          trial_ends_at: string | null
          subscription_ends_at: string | null
          max_employees: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['organizations']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: 'owner' | 'admin' | 'editor' | 'viewer'
          invited_by: string | null
          accepted_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['organization_members']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['organization_members']['Insert']>
      }
      employees: {
        Row: {
          id: string
          organization_id: string
          name: string
          email: string | null
          phone: string | null
          experience_level: 'junior' | 'mid' | 'senior'
          color: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['employees']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['employees']['Insert']>
      }
      employee_leaves: {
        Row: {
          id: string
          employee_id: string
          start_date: string
          end_date: string
          reason: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['employee_leaves']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['employee_leaves']['Insert']>
      }
      employee_unavailability: {
        Row: {
          id: string
          employee_id: string
          day_of_week: number | null
          specific_date: string | null
          note: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['employee_unavailability']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['employee_unavailability']['Insert']>
      }
      shift_definitions: {
        Row: {
          id: string
          organization_id: string
          name: string
          shift_type: 'morning' | 'afternoon' | 'night' | 'custom'
          start_time: string
          end_time: string
          crosses_midnight: boolean
          color: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['shift_definitions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['shift_definitions']['Insert']>
      }
      schedules: {
        Row: {
          id: string
          organization_id: string
          name: string
          type: 'shifts' | 'school'
          start_date: string
          end_date: string
          working_days: number[]
          include_holidays: boolean
          country_code: string
          status: 'draft' | 'generating' | 'generated' | 'published'
          generation_config: Json
          ai_suggestions: Json | null
          ai_analyzed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['schedules']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['schedules']['Insert']>
      }
      schedule_shifts: {
        Row: {
          id: string
          schedule_id: string
          shift_definition_id: string
          slots_per_day: number
        }
        Insert: Omit<Database['public']['Tables']['schedule_shifts']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['schedule_shifts']['Insert']>
      }
      shift_assignments: {
        Row: {
          id: string
          schedule_id: string
          employee_id: string
          shift_definition_id: string
          date: string
          role_in_shift: string | null
          is_manual_override: boolean
          note: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['shift_assignments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['shift_assignments']['Insert']>
      }
      constraints: {
        Row: {
          id: string
          schedule_id: string
          type: 'pair_required' | 'pair_forbidden' | 'rest_after_shift' | 'max_consecutive' | 'max_weekly_hours' | 'max_night_shifts' | 'min_seniority' | 'min_staff' | 'fixed_shift'
          employee_id: string | null
          target_employee_id: string | null
          shift_definition_id: string | null
          value: number | null
          note: string | null
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['constraints']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['constraints']['Insert']>
      }
      subjects: {
        Row: {
          id: string
          organization_id: string
          name: string
          color: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['subjects']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['subjects']['Insert']>
      }
      teacher_subjects: {
        Row: {
          id: string
          employee_id: string
          subject_id: string
          hours_per_week: number
        }
        Insert: Omit<Database['public']['Tables']['teacher_subjects']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['teacher_subjects']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      plan_type: 'free' | 'starter' | 'pro' | 'business'
      schedule_type: 'shifts' | 'school'
      member_role: 'owner' | 'admin' | 'editor' | 'viewer'
      experience_level: 'junior' | 'mid' | 'senior'
      shift_type: 'morning' | 'afternoon' | 'night' | 'custom'
      generation_status: 'draft' | 'generating' | 'generated' | 'published'
      constraint_type: 'pair_required' | 'pair_forbidden' | 'rest_after_shift' | 'max_consecutive' | 'max_weekly_hours' | 'max_night_shifts' | 'min_seniority' | 'min_staff' | 'fixed_shift'
    }
  }
}
