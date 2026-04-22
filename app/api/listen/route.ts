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
