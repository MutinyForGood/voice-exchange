import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import {
  buildOppositionSummary,
  decodeSurveyAnswers,
} from '@/lib/survey-matching'
import { Submission } from '@/types'

export async function GET(req: NextRequest) {
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

  const picked =
    oppositeMatches.length > 0
      ? oppositeMatches[Math.floor(Math.random() * oppositeMatches.length)]
      : {
          submission: data[Math.floor(Math.random() * data.length)],
          opposition: [],
        }

  const submission = picked.submission

  const { data: signedData } = await supabase.storage
    .from('voice-notes')
    .createSignedUrl(submission.audio_path, 3600)

  return NextResponse.json({
    ...submission,
    audioUrl: signedData?.signedUrl ?? null,
    matchedOnOpposites: picked.opposition,
  })
}
