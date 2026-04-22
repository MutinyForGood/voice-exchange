import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
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

    const shuffled = [...data].sort(() => Math.random() - 0.5)

    for (const submission of shuffled) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from('voice-notes')
        .createSignedUrl(submission.audio_path, 3600)

      if (signedError || !signedData?.signedUrl) {
        console.error('listen signed url error', {
          submissionId: submission.id,
          audioPath: submission.audio_path,
          message: signedError?.message,
        })
        continue
      }

      return NextResponse.json({
        ...submission,
        audioUrl: signedData.signedUrl,
        matchedOnOpposites: [],
      })
    }

    return NextResponse.json(
      { error: 'No playable approved voice notes are available right now.' },
      { status: 404 }
    )
  } catch (error) {
    console.error('listen route failed', error)
    return NextResponse.json({ error: 'Listen route failed' }, { status: 500 })
  }
}
