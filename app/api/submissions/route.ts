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
