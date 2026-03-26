# OrarPro

Smart scheduling for HoReCa, factories, schools and retail.

## Tech stack

- **Next.js 14** (App Router)
- **Supabase** (PostgreSQL + Auth + RLS)
- **Stripe** (subscriptions, 14-day trial)
- **next-intl** (Romanian + English)
- **Tailwind CSS**
- **Vercel** (deployment)
- **Claude API** (AI schedule analysis)

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/yourname/orarpro
cd orarpro
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migrations in order:

```bash
# In Supabase SQL editor, run each file in order:
supabase/migrations/001_core.sql
supabase/migrations/002_employees.sql
supabase/migrations/003_schedules.sql
supabase/migrations/004_rls.sql
supabase/migrations/005_gdpr.sql
```

3. In Supabase dashboard → Authentication → Providers → enable Google OAuth

### 3. Set up Stripe

1. Create an account at [stripe.com](https://stripe.com)
2. Create 4 products (Starter, Pro, Business — monthly + yearly each)
3. Copy the price IDs to your `.env.local`
4. Set up webhook endpoint: `https://yourapp.com/api/billing/webhook`
   - Events to listen: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

### 4. Environment variables

```bash
cp .env.example .env.local
# Fill in all values
```

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Project structure

```
src/
├── app/
│   ├── [locale]/
│   │   ├── (auth)/          # Login, register pages
│   │   └── (dashboard)/     # Protected app pages
│   ├── api/
│   │   ├── schedules/       # Generation, publish endpoints
│   │   └── billing/         # Stripe checkout, webhook
│   └── auth/callback/       # OAuth callback
├── components/
│   ├── schedule/            # ScheduleGrid, AISuggestionsPanel
│   ├── billing/             # UpgradeButton, TrialBanner
│   └── shared/              # SidebarNav, etc.
├── lib/
│   ├── supabase/            # Client, server, admin clients
│   ├── stripe/              # Config, plan definitions
│   ├── algorithms/          # Schedule generation
│   ├── ai/                  # Claude API analysis
│   ├── i18n/                # next-intl config
│   └── holidays.ts          # date.nager.at integration
├── types/                   # TypeScript types
└── middleware.ts             # Auth + i18n routing
messages/
├── ro.json                  # Romanian translations
└── en.json                  # English translations
supabase/migrations/
├── 001_core.sql             # Profiles, organizations, members
├── 002_employees.sql        # Employees, leaves, unavailability
├── 003_schedules.sql        # Shifts, schedules, assignments, constraints
├── 004_rls.sql              # Row Level Security (GDPR isolation)
└── 005_gdpr.sql             # Data export, deletion, audit log
```

## Deployment

```bash
# Push to GitHub, connect to Vercel
# Set all environment variables in Vercel dashboard
# Done — Vercel auto-deploys on push
```

## GDPR compliance

- Data isolation via Supabase RLS (each org sees only their data)
- Consent tracked at registration (separate checkboxes, not pre-checked)
- Data export: `SELECT public.export_user_data(user_id)`
- Account deletion: `SELECT public.delete_user_account(user_id)`
- Audit log for all sensitive operations
- Privacy Policy + T&C: generate at [iubenda.com](https://iubenda.com)

## Free tier limits

| Plan     | Employees | Price     |
|----------|-----------|-----------|
| Free     | 10        | 0 RON     |
| Starter  | 25        | 29 RON/mo |
| Pro      | 75        | 69 RON/mo |
| Business | Unlimited | 149 RON/mo|

All paid plans include a 14-day free trial.
