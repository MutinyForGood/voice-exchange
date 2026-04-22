import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabaseAuth = await createClient()
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()
  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

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
