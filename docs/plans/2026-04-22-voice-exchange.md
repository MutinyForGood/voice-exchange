# Voice Exchange MVP — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an anonymous voice note exchange web app where people with differing views can record and hear short audio messages, with a full submit → moderate → listen pipeline.

**Architecture:** Next.js 15 App Router with TypeScript; all DB writes go through a server-side Supabase client (service role key, never exposed to browser); audio stored in a private Supabase Storage bucket with signed URLs; transcription behind a clean provider interface so OpenAI can drop in later.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, Supabase (Postgres + Storage + Auth), MediaRecorder API, Web Speech API

**Project root:** `/Users/kellyherrington/Desktop/Claude Cowork Projects/Voice Exchange/`

---

## Task 1: Scaffold Next.js project

**Files:**
- Create: Next.js app directly in the project root

**Step 1: Create the app**
```bash
cd "/Users/kellyherrington/Desktop/Claude Cowork Projects/Voice Exchange"
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --yes
```

**Step 2: Install Supabase and utility deps**
```bash
npm install @supabase/supabase-js @supabase/ssr
npm install clsx
```

**Step 3: Verify dev server starts**
```bash
npm run dev
```
Expected: Server starts on http://localhost:3000 with default Next.js page.

**Step 4: Commit**
```bash
git init
git add .
git commit -m "chore: scaffold Next.js 15 app with Tailwind + Supabase deps"
```

---

## Task 2: Environment variables + Supabase client setup

**Files:**
- Create: `.env.local`
- Create: `.env.example`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

**Step 1: Create `.env.example`**
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Admin
ADMIN_EMAILS=admin@example.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Step 2: Create `.env.local`** — copy from `.env.example` and fill in real values from Supabase dashboard.

**Step 3: Create browser Supabase client** at `lib/supabase/client.ts`
```ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Step 4: Create server Supabase client** at `lib/supabase/server.ts`
```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// Service-role client for privileged server operations (never sent to browser)
export function createServiceClient() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

**Step 5: Commit**
```bash
git add lib/ .env.example
git commit -m "chore: add Supabase client helpers (browser + server + service role)"
```

---

## Task 3: SQL schema migration

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/seed.sql`

**Step 1: Write migration**
```sql
-- supabase/migrations/001_initial_schema.sql

create type submission_status as enum ('pending', 'approved', 'rejected');

create table submissions (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  status              submission_status not null default 'pending',
  survey_answers      jsonb not null,
  audio_path          text not null,
  audio_duration_sec  float,
  transcript          text,
  moderation_flags    jsonb not null default '[]'::jsonb,
  moderator_notes     text
);

create index idx_submissions_status     on submissions(status);
create index idx_submissions_created_at on submissions(created_at desc);

create table moderation_events (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references submissions(id) on delete cascade,
  created_at     timestamptz default now(),
  action         text not null,  -- 'approved' | 'rejected' | 'flagged'
  notes          text
);

create index idx_moderation_events_submission on moderation_events(submission_id);
```

**Step 2: Write seed data** (3 approved notes for local testing)
```sql
-- supabase/seed.sql
-- Run after schema is applied. Inserts approved test submissions.
-- Audio paths are fake; replace with real uploads when testing playback.

insert into submissions (status, survey_answers, audio_path, audio_duration_sec, transcript, moderation_flags)
values
  (
    'approved',
    '[
      {"questionId":"q1","answer":"agree"},
      {"questionId":"q2","answer":"disagree"},
      {"questionId":"q3","answer":"agree"},
      {"questionId":"q4","answer":"neutral"},
      {"questionId":"q5","answer":"agree"}
    ]',
    'audio/seed-001.webm',
    28.4,
    'I think we often talk past each other because we start from different assumptions about what fairness means. For me it comes down to whether people have a real shot, not just a theoretical one.',
    '[]'
  ),
  (
    'approved',
    '[
      {"questionId":"q1","answer":"disagree"},
      {"questionId":"q2","answer":"agree"},
      {"questionId":"q3","answer":"neutral"},
      {"questionId":"q4","answer":"disagree"},
      {"questionId":"q5","answer":"neutral"}
    ]',
    'audio/seed-002.webm',
    41.0,
    'What I want people on the other side to understand is that skepticism of government solutions is not the same as not caring. I care deeply. I just think there are better ways to help people.',
    '[]'
  ),
  (
    'approved',
    '[
      {"questionId":"q1","answer":"neutral"},
      {"questionId":"q2","answer":"agree"},
      {"questionId":"q3","answer":"agree"},
      {"questionId":"q4","answer":"agree"},
      {"questionId":"q5","answer":"disagree"}
    ]',
    'audio/seed-003.webm',
    35.2,
    'The thing I find hardest is that the news makes everyone seem like they are at the extremes. Most people I know personally are much more thoughtful than that, whatever their politics.',
    '[]'
  );
```

**Step 3: Apply schema in Supabase dashboard** (or via CLI — see README)

**Step 4: Commit**
```bash
git add supabase/
git commit -m "feat: add initial SQL schema and seed data"
```

---

## Task 4: TypeScript types

**Files:**
- Create: `types/index.ts`

**Step 1: Write types**
```ts
// types/index.ts

export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface SurveyAnswer {
  questionId: string
  answer: 'agree' | 'neutral' | 'disagree'
}

export interface ModerationFlag {
  rule: string
  matchedText: string
}

export interface Submission {
  id: string
  created_at: string
  status: SubmissionStatus
  survey_answers: SurveyAnswer[]
  audio_path: string
  audio_duration_sec: number | null
  transcript: string | null
  moderation_flags: ModerationFlag[]
  moderator_notes: string | null
}

export interface ModerationEvent {
  id: string
  submission_id: string
  created_at: string
  action: 'approved' | 'rejected' | 'flagged'
  notes: string | null
}

export interface Question {
  id: string
  text: string
  type: 'agree-neutral-disagree'
}
```

**Step 2: Commit**
```bash
git add types/
git commit -m "feat: add shared TypeScript types"
```

---

## Task 5: Survey questions + transcription adapter

**Files:**
- Create: `lib/questions.ts`
- Create: `lib/transcription/provider.ts`
- Create: `lib/transcription/browser-provider.ts`

**Step 1: Define the 5 survey questions**
```ts
// lib/questions.ts
import { Question } from '@/types'

export const QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: 'The government should ensure everyone has a minimum standard of living.',
    type: 'agree-neutral-disagree',
  },
  {
    id: 'q2',
    text: 'Immigration has been broadly positive for this country.',
    type: 'agree-neutral-disagree',
  },
  {
    id: 'q3',
    text: 'The wealth gap between rich and poor is a serious problem.',
    type: 'agree-neutral-disagree',
  },
  {
    id: 'q4',
    text: 'Climate change requires dramatic, immediate policy action.',
    type: 'agree-neutral-disagree',
  },
  {
    id: 'q5',
    text: 'Social media has done more harm than good.',
    type: 'agree-neutral-disagree',
  },
]
```

**Step 2: Define transcription provider interface**
```ts
// lib/transcription/provider.ts

export interface TranscriptionResult {
  text: string
  source: 'browser' | 'manual' | 'api'
}

export interface TranscriptionProvider {
  /**
   * Attempt to transcribe audio. Returns null if the provider
   * cannot handle this audio (e.g. browser API unavailable).
   */
  transcribe(audio: Blob): Promise<TranscriptionResult | null>
}

// TODO: implement OpenAITranscriptionProvider here when ready
// import OpenAI from 'openai'
// export class OpenAITranscriptionProvider implements TranscriptionProvider { ... }
```

**Step 3: Implement browser provider**
```ts
// lib/transcription/browser-provider.ts
import { TranscriptionProvider, TranscriptionResult } from './provider'

export class BrowserTranscriptionProvider implements TranscriptionProvider {
  async transcribe(_audio: Blob): Promise<TranscriptionResult | null> {
    // Browser speech recognition works on the live audio stream, not a blob.
    // This provider signals "not available" so the UI falls back to manual entry.
    // Real-time recognition is handled directly in the RecordingStep component.
    if (typeof window === 'undefined') return null
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return null
    // Signal available — actual text comes from the recording component
    return null
  }
}
```

**Step 4: Commit**
```bash
git add lib/
git commit -m "feat: add survey questions and transcription provider interface"
```

---

## Task 6: Moderation flag rules

**Files:**
- Create: `lib/moderation/flags.ts`

**Step 1: Write flag checker**
```ts
// lib/moderation/flags.ts
import { ModerationFlag } from '@/types'

interface FlagRule {
  rule: string
  pattern: RegExp
}

const FLAG_RULES: FlagRule[] = [
  {
    rule: 'profanity',
    pattern: /\b(fuck|shit|ass|bitch|cunt|bastard|damn)\b/i,
  },
  {
    rule: 'violent_threat',
    pattern: /\b(kill|murder|shoot|stab|bomb|attack|hurt|destroy)\s+(you|them|he|she|those|these|all)\b/i,
  },
  {
    rule: 'slur',
    // Intentionally sparse — real implementation should use a curated list
    pattern: /\b(n[i1]gg[ae]r|f[a4]gg[o0]t|sp[i1]c|ch[i1]nk|k[i1]ke|w[e3]tb[a4]ck)\b/i,
  },
  {
    rule: 'doxxing_pattern',
    // Phone numbers, emails, and "address at" patterns
    pattern: /(\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\d+\s+\w+\s+(street|st|ave|avenue|blvd|road|rd|drive|dr|lane|ln)\b)/i,
  },
  {
    rule: 'harassment',
    pattern: /\b(you('re| are) (pathetic|worthless|disgusting|stupid|an idiot|a loser)|go (kill|hurt) yourself)\b/i,
  },
]

export function checkFlags(transcript: string): ModerationFlag[] {
  const flags: ModerationFlag[] = []
  for (const { rule, pattern } of FLAG_RULES) {
    const match = transcript.match(pattern)
    if (match) {
      flags.push({ rule, matchedText: match[0] })
    }
  }
  return flags
}
```

**Step 2: Commit**
```bash
git add lib/moderation/
git commit -m "feat: add transcript moderation flag rules"
```

---

## Task 7: API routes

**Files:**
- Create: `app/api/submissions/route.ts`
- Create: `app/api/submissions/[id]/moderate/route.ts`
- Create: `app/api/listen/route.ts`
- Create: `app/api/storage/signed-url/route.ts`
- Create: `app/api/admin/submissions/route.ts`

**Step 1: POST /api/submissions — save a new submission**
```ts
// app/api/submissions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { checkFlags } from '@/lib/moderation/flags'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { audioPath, audioDurationSec, transcript, surveyAnswers } = body

  if (!audioPath || !surveyAnswers) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const flags = transcript ? checkFlags(transcript) : []
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('submissions')
    .insert({
      audio_path: audioPath,
      audio_duration_sec: audioDurationSec ?? null,
      transcript: transcript ?? null,
      survey_answers: surveyAnswers,
      moderation_flags: flags,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) {
    console.error('submissions insert error', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
```

**Step 2: POST /api/submissions/[id]/moderate — admin approve/reject**
```ts
// app/api/submissions/[id]/moderate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
  if (!user || !adminEmails.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { action, notes } = await req.json()
  if (!['approved', 'rejected'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error: updateError } = await supabase
    .from('submissions')
    .update({ status: action, moderator_notes: notes ?? null })
    .eq('id', params.id)

  if (updateError) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  await supabase.from('moderation_events').insert({
    submission_id: params.id,
    action,
    notes: notes ?? null,
  })

  return NextResponse.json({ ok: true })
}
```

**Step 3: GET /api/listen — serve one random approved submission**
```ts
// app/api/listen/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const excludeId = req.nextUrl.searchParams.get('exclude')
  const supabase = createServiceClient()

  let query = supabase
    .from('submissions')
    .select('id, audio_path, audio_duration_sec, transcript, survey_answers')
    .eq('status', 'approved')
    .limit(50)

  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query
  if (error || !data || data.length === 0) {
    return NextResponse.json({ error: 'No approved submissions' }, { status: 404 })
  }

  const submission = data[Math.floor(Math.random() * data.length)]

  const { data: signedData } = await supabase.storage
    .from('voice-notes')
    .createSignedUrl(submission.audio_path, 3600)

  return NextResponse.json({
    ...submission,
    audioUrl: signedData?.signedUrl ?? null,
  })
}
```

**Step 4: GET /api/storage/signed-url — signed URL for admin audio playback**
```ts
// app/api/storage/signed-url/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
  if (!user || !adminEmails.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  const supabase = createServiceClient()
  const { data } = await supabase.storage
    .from('voice-notes')
    .createSignedUrl(path, 3600)

  return NextResponse.json({ url: data?.signedUrl ?? null })
}
```

**Step 5: GET /api/admin/submissions — list submissions by status for admin**
```ts
// app/api/admin/submissions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabaseAuth = await createClient()
  const { data: { user } } = await supabaseAuth.auth.getUser()
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())
  if (!user || !adminEmails.includes(user.email ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const status = req.nextUrl.searchParams.get('status') ?? 'pending'
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('status', status)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  const submissions = await Promise.all(
    (data ?? []).map(async (s: any) => {
      const { data: signed } = await supabase.storage
        .from('voice-notes')
        .createSignedUrl(s.audio_path, 3600)
      return { ...s, audioUrl: signed?.signedUrl ?? null }
    })
  )

  return NextResponse.json({ submissions })
}
```

**Step 6: Commit**
```bash
git add app/api/
git commit -m "feat: add API routes for submissions, moderation, listen, and admin"
```

---

## Task 8: Admin auth middleware

**Files:**
- Create: `middleware.ts`

**Step 1: Write middleware**
```ts
// middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith('/admin') || pathname === '/admin/login') {
    return NextResponse.next()
  }

  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const adminEmails = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim())

  if (!user || !adminEmails.includes(user.email ?? '')) {
    return NextResponse.redirect(new URL('/admin/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}
```

**Step 2: Commit**
```bash
git add middleware.ts
git commit -m "feat: add admin auth middleware with email allowlist"
```

---

## Task 9: Shared UI components

**Files:**
- Create: `components/Button.tsx`
- Create: `components/ProgressBar.tsx`
- Create: `components/AudioPlayer.tsx`

**Step 1: Button component**
```tsx
// components/Button.tsx
import { ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
}

export function Button({ variant = 'primary', className, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-zinc-900 text-white hover:bg-zinc-700': variant === 'primary',
          'bg-zinc-100 text-zinc-900 hover:bg-zinc-200': variant === 'secondary',
          'bg-red-600 text-white hover:bg-red-700': variant === 'danger',
          'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100': variant === 'ghost',
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}
```

**Step 2: Progress bar**
```tsx
// components/ProgressBar.tsx
interface ProgressBarProps {
  current: number
  total: number
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-zinc-400 mb-1">
        <span>{current} of {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-zinc-900 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
```

**Step 3: Audio player**
```tsx
// components/AudioPlayer.tsx
'use client'
import { useRef, useState } from 'react'
import { Button } from './Button'

interface AudioPlayerProps {
  src: string
  label?: string
}

export function AudioPlayer({ src, label }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setPlaying(!playing)
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
      <Button variant="ghost" onClick={toggle} className="w-8 h-8 p-0">
        {playing ? '⏸' : '▶'}
      </Button>
      <div className="flex-1">
        {label && <p className="text-xs text-zinc-500 mb-1">{label}</p>}
        <div className="h-1 bg-zinc-200 rounded-full overflow-hidden">
          <div className="h-full bg-zinc-900 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => {
          if (!audioRef.current) return
          setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100)
        }}
        onEnded={() => setPlaying(false)}
      />
    </div>
  )
}
```

**Step 4: Commit**
```bash
git add components/
git commit -m "feat: add shared Button, ProgressBar, and AudioPlayer components"
```

---

## Task 10: Home page

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`

**Step 1: Update layout**
```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Voice Exchange',
  description: 'Hear from someone who sees things differently.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-white text-zinc-900 antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

**Step 2: Write home page**
```tsx
// app/page.tsx
import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight mb-3">Voice Exchange</h1>
      <p className="text-zinc-500 text-lg mb-10 max-w-sm">
        Share your perspective. Hear from someone who sees things differently.
        Anonymous. Unfiltered. Real.
      </p>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/submit/survey"
          className="w-full bg-zinc-900 text-white rounded-lg px-6 py-3 text-sm font-medium hover:bg-zinc-700 transition-colors text-center"
        >
          Share your voice
        </Link>
        <Link
          href="/listen"
          className="w-full bg-zinc-100 text-zinc-900 rounded-lg px-6 py-3 text-sm font-medium hover:bg-zinc-200 transition-colors text-center"
        >
          Hear someone else
        </Link>
      </div>
    </main>
  )
}
```

**Step 3: Commit**
```bash
git add app/
git commit -m "feat: add home page with submit and listen CTAs"
```

---

## Task 11: Survey page

**Files:**
- Create: `app/submit/survey/page.tsx`
- Create: `app/submit/survey/SurveyClient.tsx`

**Step 1: Write survey client component**
```tsx
// app/submit/survey/SurveyClient.tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QUESTIONS } from '@/lib/questions'
import { SurveyAnswer } from '@/types'
import { ProgressBar } from '@/components/ProgressBar'
import { Button } from '@/components/Button'

type Answer = 'agree' | 'neutral' | 'disagree'

const OPTIONS: { value: Answer; label: string }[] = [
  { value: 'agree', label: 'Agree' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'disagree', label: 'Disagree' },
]

export function SurveyClient() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const question = QUESTIONS[step]
  const selected = answers[question.id]

  const handleAnswer = (value: Answer) => {
    setAnswers(prev => ({ ...prev, [question.id]: value }))
  }

  const handleNext = () => {
    if (!selected) return
    if (step < QUESTIONS.length - 1) {
      setStep(s => s + 1)
    } else {
      const surveyAnswers: SurveyAnswer[] = QUESTIONS.map(q => ({
        questionId: q.id,
        answer: answers[q.id],
      }))
      sessionStorage.setItem('surveyAnswers', JSON.stringify(surveyAnswers))
      router.push('/submit/record')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <ProgressBar current={step + 1} total={QUESTIONS.length} />
        </div>

        <h2 className="text-xl font-semibold mb-8 leading-snug">{question.text}</h2>

        <div className="flex flex-col gap-3 mb-10">
          {OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleAnswer(opt.value)}
              className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-colors text-sm font-medium ${
                selected === opt.value
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 hover:border-zinc-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Button onClick={handleNext} disabled={!selected} className="w-full py-3">
          {step < QUESTIONS.length - 1 ? 'Next' : 'Continue to recording'}
        </Button>
      </div>
    </div>
  )
}
```

**Step 2: Write survey page**
```tsx
// app/submit/survey/page.tsx
import { SurveyClient } from './SurveyClient'
export default function SurveyPage() { return <SurveyClient /> }
```

**Step 3: Commit**
```bash
git add app/submit/survey/
git commit -m "feat: add survey step with progress bar and sessionStorage handoff"
```

---

## Task 12: Recording page

**Files:**
- Create: `app/submit/record/page.tsx`
- Create: `app/submit/record/RecordingClient.tsx`

**Step 1: Write recording client**
```tsx
// app/submit/record/RecordingClient.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import { AudioPlayer } from '@/components/AudioPlayer'
import { createClient } from '@/lib/supabase/client'

const MAX_SECONDS = 60

type Stage = 'idle' | 'requesting' | 'recording' | 'preview' | 'submitting' | 'error'

export function RecordingClient() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const [speechAvailable, setSpeechAvailable] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobEvent['data'][]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSpeechAvailable(!!SR)
  }, [])

  const startRecording = async () => {
    setStage('requesting')
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(t => t.stop())
        setStage('preview')
      }

      recorder.start()
      setStage('recording')
      setElapsed(0)

      timerRef.current = setInterval(() => {
        setElapsed(prev => {
          if (prev >= MAX_SECONDS - 1) {
            stopRecording()
            return MAX_SECONDS
          }
          return prev + 1
        })
      }, 1000)

      if (speechAvailable) {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        const recognition = new SR()
        recognition.continuous = true
        recognition.interimResults = false
        recognition.lang = 'en-US'
        recognition.onresult = (event: any) => {
          const newText = Array.from(event.results)
            .map((r: any) => r[0].transcript)
            .join(' ')
          setTranscript(newText)
        }
        recognition.start()
        recognitionRef.current = recognition
      }
    } catch (err: any) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Microphone access was denied. Please allow mic access and try again.'
          : 'Could not start recording. Check your microphone and try again.'
      )
      setStage('error')
    }
  }

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop()
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
  }

  const discard = () => {
    setAudioBlob(null)
    setAudioUrl(null)
    setTranscript('')
    setElapsed(0)
    setStage('idle')
  }

  const submit = async () => {
    if (!audioBlob) return
    const surveyAnswers = sessionStorage.getItem('surveyAnswers')
    if (!surveyAnswers) {
      setError('Survey answers missing. Please go back and complete the survey.')
      return
    }

    setStage('submitting')
    try {
      const supabase = createClient()
      const fileName = `audio/${Date.now()}.webm`

      if (audioBlob.size > 10 * 1024 * 1024) {
        setError('Recording is too large. Please keep it under 60 seconds.')
        setStage('preview')
        return
      }

      const { error: uploadError } = await supabase.storage
        .from('voice-notes')
        .upload(fileName, audioBlob, { contentType: 'audio/webm', upsert: false })

      if (uploadError) throw uploadError

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioPath: fileName,
          audioDurationSec: elapsed,
          transcript: transcript || null,
          surveyAnswers: JSON.parse(surveyAnswers),
        }),
      })

      if (!res.ok) throw new Error('Submission failed')

      sessionStorage.removeItem('surveyAnswers')
      router.push('/submit/done')
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
      setStage('preview')
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2">Record your voice note</h1>
        <p className="text-zinc-500 text-sm mb-8">
          Speak directly to someone who sees things differently. Max 60 seconds.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {stage === 'idle' && (
          <Button onClick={startRecording} className="w-full py-4 text-base">
            Start recording
          </Button>
        )}

        {stage === 'requesting' && (
          <p className="text-zinc-500 text-sm text-center">Waiting for microphone permission...</p>
        )}

        {stage === 'recording' && (
          <div className="text-center">
            <div className="text-5xl font-mono mb-4">
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
              {String(elapsed % 60).padStart(2, '0')}
            </div>
            <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mb-6 animate-pulse" />
            <div className="text-xs text-zinc-400 mb-6">{MAX_SECONDS - elapsed}s remaining</div>
            <Button onClick={stopRecording} variant="secondary" className="w-full py-3">
              Stop recording
            </Button>
          </div>
        )}

        {stage === 'preview' && audioUrl && (
          <div>
            <AudioPlayer src={audioUrl} label="Your recording" />

            <div className="mt-6">
              <label className="block text-sm font-medium mb-2">
                Transcript
                {speechAvailable
                  ? ' (auto-generated — edit if needed)'
                  : ' (type what you said to help with review)'}
              </label>
              <textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                className="w-full h-28 border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-zinc-900"
                placeholder={speechAvailable ? '' : 'Optional but helpful for moderation...'}
              />
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={discard} className="flex-1 py-3">
                Re-record
              </Button>
              <Button onClick={submit} className="flex-1 py-3">
                Submit
              </Button>
            </div>
          </div>
        )}

        {stage === 'submitting' && (
          <p className="text-center text-zinc-500 text-sm">Submitting your voice note...</p>
        )}
      </div>
    </div>
  )
}
```

**Step 2: Write record page**
```tsx
// app/submit/record/page.tsx
import { RecordingClient } from './RecordingClient'
export default function RecordPage() { return <RecordingClient /> }
```

**Step 3: Commit**
```bash
git add app/submit/record/
git commit -m "feat: add recording step with MediaRecorder, speech recognition, and Supabase upload"
```

---

## Task 13: Submit done page

**Files:**
- Create: `app/submit/done/page.tsx`

**Step 1: Write done page**
```tsx
// app/submit/done/page.tsx
import Link from 'next/link'

export default function DonePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <div className="text-4xl mb-4">🎙</div>
      <h1 className="text-2xl font-bold mb-3">Voice note submitted</h1>
      <p className="text-zinc-500 text-sm mb-8 max-w-xs">
        Your recording is in review. Once approved it will be shared anonymously with listeners.
      </p>
      <Link href="/listen" className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-900">
        Hear someone else in the meantime
      </Link>
    </main>
  )
}
```

**Step 2: Commit**
```bash
git add app/submit/done/
git commit -m "feat: add submission confirmation page"
```

---

## Task 14: Listener page

**Files:**
- Create: `app/listen/page.tsx`
- Create: `app/listen/ListenClient.tsx`

**Step 1: Write listener client**
```tsx
// app/listen/ListenClient.tsx
'use client'
import { useState, useCallback } from 'react'
import { AudioPlayer } from '@/components/AudioPlayer'
import { Button } from '@/components/Button'

interface NoteData {
  id: string
  audioUrl: string
  audio_duration_sec: number | null
}

export function ListenClient() {
  const [note, setNote] = useState<NoteData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  const fetchNote = useCallback(async (excludeId?: string) => {
    setLoading(true)
    setError(null)
    try {
      const url = excludeId ? `/api/listen?exclude=${excludeId}` : '/api/listen'
      const res = await fetch(url)
      if (res.status === 404) {
        setError('No approved voice notes yet. Check back soon.')
        setNote(null)
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setNote(data)
    } catch {
      setError('Something went wrong loading a voice note.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleStart = () => {
    setStarted(true)
    fetchNote()
  }

  const handleNext = () => fetchNote(note?.id)

  if (!started) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <h1 className="text-3xl font-bold mb-3">Hear a different perspective</h1>
        <p className="text-zinc-500 mb-8 max-w-sm text-sm">
          You'll hear a short, anonymous voice note from someone who might see things very differently from you.
        </p>
        <Button onClick={handleStart} className="px-8 py-3 text-base">
          I'm ready to listen
        </Button>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2">A voice note for you</h1>
        <p className="text-zinc-500 text-sm mb-8">Anonymous. Unfiltered. Real.</p>

        {error && (
          <div className="p-4 bg-zinc-50 rounded-lg text-zinc-600 text-sm text-center">{error}</div>
        )}

        {loading && (
          <div className="text-center text-zinc-400 text-sm py-8">Loading...</div>
        )}

        {note && !loading && (
          <div>
            <AudioPlayer src={note.audioUrl} label="Voice note" />
            <Button onClick={handleNext} variant="secondary" className="w-full mt-6 py-3">
              Hear another
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
```

**Step 2: Write listen page**
```tsx
// app/listen/page.tsx
import { ListenClient } from './ListenClient'
export default function ListenPage() { return <ListenClient /> }
```

**Step 3: Commit**
```bash
git add app/listen/
git commit -m "feat: add listener page with random approved note playback"
```

---

## Task 15: Admin login page

**Files:**
- Create: `app/admin/login/page.tsx`
- Create: `app/admin/login/LoginClient.tsx`

**Step 1: Write login client**
```tsx
// app/admin/login/LoginClient.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/Button'

export function LoginClient() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    })
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold mb-3">Check your email</h1>
          <p className="text-zinc-500 text-sm">
            We sent a magic link to <strong>{email}</strong>. Click it to sign in as admin.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-2">Admin login</h1>
        <p className="text-zinc-500 text-sm mb-8">Enter your admin email to receive a magic link.</p>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@example.com"
            required
            className="border border-zinc-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <Button type="submit" disabled={loading} className="py-3">
            {loading ? 'Sending...' : 'Send magic link'}
          </Button>
        </form>
      </div>
    </main>
  )
}
```

**Step 2: Write login page**
```tsx
// app/admin/login/page.tsx
import { LoginClient } from './LoginClient'
export default function AdminLoginPage() { return <LoginClient /> }
```

**Step 3: Commit**
```bash
git add app/admin/login/
git commit -m "feat: add admin login page with Supabase magic link auth"
```

---

## Task 16: Admin moderation dashboard

**Files:**
- Create: `app/admin/page.tsx`
- Create: `app/admin/AdminClient.tsx`
- Create: `app/admin/SubmissionCard.tsx`

**Step 1: Write submission card**
```tsx
// app/admin/SubmissionCard.tsx
'use client'
import { useState } from 'react'
import { Submission } from '@/types'
import { AudioPlayer } from '@/components/AudioPlayer'
import { Button } from '@/components/Button'
import { QUESTIONS } from '@/lib/questions'

interface SubmissionCardProps {
  submission: Submission & { audioUrl: string }
  onAction: (id: string, action: 'approved' | 'rejected', notes?: string) => void
}

export function SubmissionCard({ submission, onAction }: SubmissionCardProps) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const act = async (action: 'approved' | 'rejected') => {
    setLoading(true)
    await onAction(submission.id, action, notes)
    setLoading(false)
  }

  const hasFlags = submission.moderation_flags.length > 0

  return (
    <div className={`border rounded-xl p-5 ${hasFlags ? 'border-amber-300 bg-amber-50' : 'border-zinc-200'}`}>
      <div className="mb-3">
        <p className="text-xs text-zinc-400">{new Date(submission.created_at).toLocaleString()}</p>
        {hasFlags && (
          <div className="mt-1 flex flex-wrap gap-1">
            {submission.moderation_flags.map(f => (
              <span key={f.rule} className="text-xs bg-amber-200 text-amber-800 rounded px-2 py-0.5">
                {f.rule}: "{f.matchedText}"
              </span>
            ))}
          </div>
        )}
      </div>

      <AudioPlayer src={submission.audioUrl} label="Audio" />

      {submission.transcript && (
        <div className="mt-3">
          <p className="text-xs font-medium text-zinc-500 mb-1">Transcript</p>
          <p className="text-sm text-zinc-700 bg-white rounded p-3 border border-zinc-100">
            {submission.transcript}
          </p>
        </div>
      )}

      <div className="mt-3">
        <p className="text-xs font-medium text-zinc-500 mb-2">Survey answers</p>
        <div className="space-y-1">
          {submission.survey_answers.map(a => {
            const q = QUESTIONS.find(q => q.id === a.questionId)
            return (
              <div key={a.questionId} className="flex justify-between text-xs">
                <span className="text-zinc-500 truncate pr-2">{q?.text ?? a.questionId}</span>
                <span className="font-medium capitalize shrink-0">{a.answer}</span>
              </div>
            )
          })}
        </div>
      </div>

      <textarea
        placeholder="Moderator notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="w-full h-16 mt-4 border border-zinc-200 rounded px-3 py-2 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-zinc-900"
      />

      <div className="flex gap-2 mt-3">
        <Button variant="danger" onClick={() => act('rejected')} disabled={loading} className="flex-1">
          Reject
        </Button>
        <Button onClick={() => act('approved')} disabled={loading} className="flex-1">
          Approve
        </Button>
      </div>
    </div>
  )
}
```

**Step 2: Write admin client**
```tsx
// app/admin/AdminClient.tsx
'use client'
import { useEffect, useState } from 'react'
import { Submission } from '@/types'
import { SubmissionCard } from './SubmissionCard'

type Tab = 'pending' | 'approved' | 'rejected'

export function AdminClient() {
  const [tab, setTab] = useState<Tab>('pending')
  const [submissions, setSubmissions] = useState<(Submission & { audioUrl: string })[]>([])
  const [loading, setLoading] = useState(true)

  const load = async (status: Tab) => {
    setLoading(true)
    const res = await fetch(`/api/admin/submissions?status=${status}`)
    const data = await res.json()
    setSubmissions(data.submissions ?? [])
    setLoading(false)
  }

  useEffect(() => { load(tab) }, [tab])

  const handleAction = async (id: string, action: 'approved' | 'rejected', notes?: string) => {
    await fetch(`/api/submissions/${id}/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes }),
    })
    load(tab)
  }

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Moderation queue</h1>

        <div className="flex gap-2 mb-6">
          {(['pending', 'approved', 'rejected'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {loading && <p className="text-zinc-400 text-sm">Loading...</p>}
        {!loading && submissions.length === 0 && (
          <p className="text-zinc-400 text-sm">No {tab} submissions.</p>
        )}

        <div className="space-y-4">
          {submissions.map(s => (
            <SubmissionCard key={s.id} submission={s} onAction={handleAction} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

**Step 3: Write admin page**
```tsx
// app/admin/page.tsx
import { AdminClient } from './AdminClient'
export default function AdminPage() { return <AdminClient /> }
```

**Step 4: Commit**
```bash
git add app/admin/
git commit -m "feat: add admin moderation dashboard with approve/reject and audio playback"
```

---

## Task 17: README

**Files:**
- Create: `README.md`

**Step 1: Write README**
```markdown
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

```
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
```

**Step 2: Commit**
```bash
git add README.md
git commit -m "docs: add README with setup and deploy instructions"
```

---

## Task 18: Final check

**Step 1: TypeScript check**
```bash
npx tsc --noEmit
```
Expected: No errors.

**Step 2: Start dev server and verify these routes load**
```bash
npm run dev
```
- http://localhost:3000 — home
- http://localhost:3000/submit/survey — survey
- http://localhost:3000/listen — listener
- http://localhost:3000/admin/login — login form
- http://localhost:3000/admin — redirects to /admin/login

**Step 3: Final commit**
```bash
git add .
git commit -m "chore: final type check and cleanup"
```

---

## Supabase Setup Checklist

1. Create project at supabase.com
2. SQL Editor → run `supabase/migrations/001_initial_schema.sql`
3. Storage → create bucket `voice-notes` → **private**
4. Authentication → Providers → enable **Email** (magic link)
5. Authentication → URL Configuration → add `http://localhost:3000/**` to Redirect URLs
6. Copy Project URL + anon key + service role key to `.env.local`
7. Set `ADMIN_EMAILS` to your email in `.env.local`
8. Optional: run `supabase/seed.sql` in SQL Editor
```
