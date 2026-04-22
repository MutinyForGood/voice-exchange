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
    <div
      className={`rounded-xl border p-5 ${
        hasFlags ? 'border-amber-300 bg-amber-50' : 'border-zinc-200'
      }`}
    >
      <div className="mb-3">
        <p className="text-xs text-zinc-400">
          {new Date(submission.created_at).toLocaleString()}
        </p>
        {hasFlags && (
          <div className="mt-1 flex flex-wrap gap-1">
            {submission.moderation_flags.map((f) => (
              <span
                key={f.rule}
                className="rounded bg-amber-200 px-2 py-0.5 text-xs text-amber-800"
              >
                {f.rule}: &quot;{f.matchedText}&quot;
              </span>
            ))}
          </div>
        )}
      </div>

      <AudioPlayer src={submission.audioUrl} label="Audio" />

      {submission.transcript && (
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-zinc-500">Transcript</p>
          <p className="rounded border border-zinc-100 bg-white p-3 text-sm text-zinc-700">
            {submission.transcript}
          </p>
        </div>
      )}

      <div className="mt-3">
        <p className="mb-2 text-xs font-medium text-zinc-500">Survey answers</p>
        <div className="space-y-1">
          {submission.survey_answers.map((a) => {
            const q = QUESTIONS.find((q) => q.id === a.questionId)
            return (
              <div key={a.questionId} className="flex justify-between text-xs">
                <span className="truncate pr-2 text-zinc-500">{q?.text ?? a.questionId}</span>
                <span className="shrink-0 font-medium capitalize">{a.answer}</span>
              </div>
            )
          })}
        </div>
      </div>

      <textarea
        placeholder="Moderator notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="mt-4 h-16 w-full resize-none rounded border border-zinc-200 px-3 py-2 text-xs focus:ring-1 focus:ring-zinc-900 focus:outline-none"
      />

      <div className="mt-3 flex gap-2">
        <Button
          variant="danger"
          onClick={() => act('rejected')}
          disabled={loading}
          className="flex-1"
        >
          Reject
        </Button>
        <Button onClick={() => act('approved')} disabled={loading} className="flex-1">
          Approve
        </Button>
      </div>
    </div>
  )
}
