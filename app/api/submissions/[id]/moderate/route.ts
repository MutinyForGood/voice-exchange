import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  const { action, notes } = await req.json()
  if (!['approved', 'rejected'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error: updateError } = await supabase
    .from('submissions')
    .update({ status: action, moderator_notes: notes ?? null })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  await supabase.from('moderation_events').insert({
    submission_id: id,
    action,
    notes: notes ?? null,
  })

  return NextResponse.json({ ok: true })
}
