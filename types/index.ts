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
