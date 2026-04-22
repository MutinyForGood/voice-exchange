'use client'

import { useState, useCallback } from 'react'
import { AudioPlayer } from '@/components/AudioPlayer'
import { Button } from '@/components/Button'
import { ListenMatchSummary, SurveyAnswer } from '@/types'
import { encodeSurveyAnswers } from '@/lib/survey-matching'
import { QUESTIONS } from '@/lib/questions'

interface NoteData {
  id: string
  audioUrl: string
  audio_duration_sec: number | null
  matchedOnOpposites: ListenMatchSummary[]
}

export function ListenClient() {
  const [note, setNote] = useState<NoteData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const [usedMatching, setUsedMatching] = useState(false)

  const fetchNote = useCallback(async (excludeId?: string) => {
    setLoading(true)
    setError(null)
    try {
      const storedAnswers = sessionStorage.getItem('surveyAnswers')
      const surveyAnswers: SurveyAnswer[] = storedAnswers ? JSON.parse(storedAnswers) : []
      const query = new URLSearchParams()

      if (excludeId) query.set('exclude', excludeId)
      if (surveyAnswers.length > 0) {
        query.set('answers', encodeSurveyAnswers(surveyAnswers))
      }

      const url = query.toString() ? `/api/listen?${query}` : '/api/listen'
      const res = await fetch(url)
      if (res.status === 404) {
        setError('No approved voice notes yet. Check back soon.')
        setNote(null)
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setNote(data)
      setUsedMatching(Array.isArray(data.matchedOnOpposites) && data.matchedOnOpposites.length > 0)
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
      <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-3 text-3xl font-bold">Hear a different perspective</h1>
        <p className="mb-8 max-w-sm text-sm text-zinc-500">
          You&apos;ll hear a short, anonymous voice note from someone who might see things
          very differently from you.
        </p>
        <Button onClick={handleStart} className="px-8 py-3 text-base">
          I&apos;m ready to listen
        </Button>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-2xl font-bold">A voice note for you</h1>
        <p className="mb-8 text-sm text-zinc-500">
          Anonymous. Real. Chosen to help you hear from someone who answered
          differently than you.
        </p>

        {error && (
          <div className="rounded-lg bg-zinc-50 p-4 text-center text-sm text-zinc-600">
            {error}
          </div>
        )}

        {loading && <div className="py-8 text-center text-sm text-zinc-400">Loading...</div>}

        {note && !loading && (
          <div>
            {usedMatching && (
              <div className="mb-4 rounded-lg bg-zinc-50 p-4 text-sm text-zinc-600">
                <p className="font-medium text-zinc-900">Why this note?</p>
                <p className="mt-1">
                  We matched you with someone who answered differently on:
                </p>
                <ul className="mt-2 space-y-1">
                  {note.matchedOnOpposites.map((match) => {
                    const question = QUESTIONS.find((q) => q.id === match.questionId)
                    return (
                      <li key={match.questionId}>
                        {question?.text ?? match.questionId}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
            <AudioPlayer src={note.audioUrl} label="Voice note" />
            <Button onClick={handleNext} variant="secondary" className="mt-6 w-full py-3">
              Hear another
            </Button>
          </div>
        )}
      </div>
    </main>
  )
}
