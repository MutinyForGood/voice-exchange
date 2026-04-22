# Voice Exchange

Anonymous voice note exchange between people who disagree. Submitters answer a short survey and record a voice note. Moderators review and approve. Listeners hear one approved note at a time.

## Stack

- Next.js 15 App Router + TypeScript
- Tailwind CSS
- Supabase (Postgres, Storage, Auth)

## Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/migrations/001_initial_schema.sql`
3. Go to **Storage** → create bucket `voice-notes` → set to **private**
4. Go to **Authentication → Providers** → enable **Email** (magic link / OTP)
5. Go to **Authentication → URL Configuration** → add `http://localhost:3000/**` to Redirect URLs
6. Copy your Project URL, anon key, and service role key

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_EMAILS=your@email.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Local Dev

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Seed Data

In the Supabase SQL Editor, run `supabase/seed.sql` to insert 3 approved test submissions. Note: the seed audio paths are placeholders — playback will fail unless you upload matching files to Storage.

## Deploy to Vercel

1. Push to GitHub
2. Import repo in Vercel
3. Add all environment variables in Vercel project settings
4. Add your Vercel deployment URL to Supabase Auth Redirect URLs
5. Deploy

## Routes

| Route | Description |
|-------|-------------|
| `/` | Home |
| `/submit/survey` | 5-question survey |
| `/submit/record` | Record voice note |
| `/submit/done` | Confirmation |
| `/listen` | Public listener |
| `/admin/login` | Admin magic link login |
| `/admin` | Moderation dashboard |


