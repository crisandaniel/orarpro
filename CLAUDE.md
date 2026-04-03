# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Build for production
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript check (tsc --noEmit)
```

## Architecture

**OrarPro** is a Next.js 14 SaaS app for employee and class scheduling, targeting HoReCa, factories, schools, and retail. It uses the App Router with TypeScript, Tailwind CSS, Supabase (PostgreSQL + Auth + RLS), Stripe for billing, Claude API for AI analysis, and next-intl for Romanian/English i18n.

### Routing

All user-facing pages live under `src/app/[locale]/`:
- `(auth)/` — login, register, setup (public)
- `(dashboard)/` — protected app pages (schedules, employees, billing, settings)
- `(print)/` — print-friendly schedule views

Middleware (`src/middleware.ts`) handles: Supabase session refresh, auth redirects, and locale routing (`/` → `/ro` by default). API routes (`/api/*`) bypass middleware.

### Data Flow

- **`src/lib/dal/`** — Data Access Layer: all Supabase queries and mutations. API routes call DAL functions; components don't query Supabase directly.
- **`src/lib/supabase/`** — Two Supabase clients: `client.ts` (browser) and `server.ts` (SSR, uses cookies).
- **API routes** (`src/app/api/`) are organized by domain: `schedules/`, `employees/`, `billing/`, `organizations/`, `resources/`.

### Schedule Generation

Two scheduling modes exist with separate algorithm implementations:

- **Business/HoReCa**: shift-based (`src/lib/algorithms/shift-generator.ts`, `generate.ts`)
- **School**: timetable-based (`src/lib/algorithms/school-generator.ts`, `greedy-school.ts`)

An optional external Google OR-Tools CP-SAT solver is used for optimization (configured via `SOLVER_URL`).

### Multi-tenancy & Auth

- Supabase RLS enforces per-organization data isolation — every DB table has RLS policies (`supabase/migrations/004_rls.sql`).
- Users can belong to multiple organizations and switch between them.
- Auth: Supabase (email/password + Google OAuth). Stripe subscription state gates feature access.

### i18n

- Translations: `messages/ro.json` and `messages/en.json`
- next-intl routing: locale is the first URL segment (`/ro/*`, `/en/*`)
- `src/lib/i18n/` contains next-intl config and routing setup

### Key Libraries

| Purpose | Library |
|---|---|
| UI primitives | Radix UI |
| Icons | Lucide React |
| Forms | React Hook Form + Zod |
| Dates | date-fns |
| Toasts | Sonner |
| Styling helpers | clsx + tailwind-merge |

### Environment Variables

Required in `.env.local` (see `.env.example`):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_*_MONTHLY/YEARLY` — 6 Stripe price IDs (3 plans × 2 billing cycles)
- `ANTHROPIC_API_KEY` — Claude API for schedule analysis
- `SOLVER_URL` — external OR-Tools API (optional optimization)
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`

### Database

Migrations are in `supabase/migrations/`. The schema includes:
- `profiles`, `organizations`, `organization_members` — core identity
- `employees`, `employee_leaves` — staff management
- `schedules`, `shifts`, `schedule_assignments`, `schedule_constraints` — business scheduling
- `lessons` (school-specific) — class timetables
- `audit_log` — GDPR audit trail

GDPR compliance is built-in: `export_user_data()` and `delete_user_account()` Supabase functions in `006_gdpr.sql`.
