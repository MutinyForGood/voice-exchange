import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  buildOppositionSummary,
  decodeSurveyAnswers,
} from '@/lib/survey-matching'
import { Submission } from '@/types'

export async function GET(req: NextRequest) {
  try {
    const excludeId = req.nextUrl.searchParams.get('exclude')
    const listenerAnswers = decodeSurveyAnswers(req.nextUrl.searchParams.get('answers'))
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

    const oppositeMatches =
      listenerAnswers.length > 0
        ? data
            .map((submission: Pick<Submission, 'survey_answers'> & Record<string, any>) => ({
              submission,
              opposition: buildOppositionSummary(listenerAnswers, submission.survey_answers),
            }))
            .filter((entry: { opposition: unknown[] }) => entry.opposition.length > 0)
        : []

    const candidates =
      oppositeMatches.length > 0
        ? oppositeMatches
        : data.map((submission: Pick<Submission, 'survey_answers'> & Record<string, any>) => ({
            submission,
            opposition: [],
          }))

    for (const candidate of candidates) {
      const { data: signedData, error: signedError } = await supabase.storage
        .from('voice-notes')
        .createSignedUrl(candidate.submission.audio_path, 3600)

      if (signedError || !signedData?.signedUrl) {
        console.error('listen signed url error', {
          submissionId: candidate.submission.id,
          audioPath: candidate.submission.audio_path,
          message: signedError?.message,
        })
        continue
      }

      return NextResponse.json({
        ...candidate.submission,
        audioUrl: signedData.signedUrl,
        matchedOnOpposites: candidate.opposition,
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
