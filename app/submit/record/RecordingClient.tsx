'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/Button'
import { AudioPlayer } from '@/components/AudioPlayer'
import { createClient } from '@/lib/supabase/client'
import { checkFlags, hasBlockingFlags } from '@/lib/moderation/flags'

const MAX_SECONDS = 60

type Stage =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'preview'
  | 'submitting'
  | 'error'

export function RecordingClient() {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [transcript, setTranscript] = useState('')
  const [speechAvailable, setSpeechAvailable] = useState(false)
  const [commonGroundPrompt, setCommonGroundPrompt] = useState(
    'Speak to someone who answered differently than you. What do you wish they understood about your perspective, and where do you think you might still find common ground?'
  )

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobEvent['data'][]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSpeechAvailable(!!SR)
  }, [])

  useEffect(() => {
    const storedAnswers = sessionStorage.getItem('surveyAnswers')
    if (!storedAnswers) return

    try {
      const answers = JSON.parse(storedAnswers) as { answer: string }[]
      const agreeCount = answers.filter((answer) => answer.answer === 'agree').length
      const disagreeCount = answers.filter((answer) => answer.answer === 'disagree').length

      if (agreeCount === disagreeCount) {
        setCommonGroundPrompt(
          'Speak to someone who answered differently than you. What would surprise them about you, and where do you think the two of you might still agree?'
        )
        return
      }

      setCommonGroundPrompt(
        'Speak to someone on the other side of these questions. Share your honest take, but try to name one value or experience you think you might still have in common.'
      )
    } catch {}
  }, [])

  const startRecording = async () => {
    setStage('requesting')
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
        setStage('preview')
      }

      recorder.start()
      setStage('recording')
      setElapsed(0)

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev >= MAX_SECONDS - 1) {
            stopRecording()
            return MAX_SECONDS
          }
          return prev + 1
        })
      }, 1000)

      if (speechAvailable) {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        const recognition = new SR()
        recognition.continuous = true
        recognition.interimResults = false
        recognition.lang = 'en-US'
        recognition.onresult = (event: any) => {
          const newText = Array.from(event.results)
            .map((r: any) => r[0].transcript)
            .join(' ')
          setTranscript(newText)
        }
        recognition.start()
        recognitionRef.current = recognition
      }
    } catch (err: any) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Microphone access was denied. Please allow mic access and try again.'
          : 'Could not start recording. Check your microphone and try again.'
      )
      setStage('error')
    }
  }

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop()
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }
  }

  const discard = () => {
    setAudioBlob(null)
    setAudioUrl(null)
    setTranscript('')
    setElapsed(0)
    setStage('idle')
  }

  const submit = async () => {
    if (!audioBlob) return
    const surveyAnswers = sessionStorage.getItem('surveyAnswers')
    if (!surveyAnswers) {
      setError('Survey answers missing. Please go back and complete the survey.')
      return
    }

    setStage('submitting')
    try {
      const flags = transcript ? checkFlags(transcript) : []
      if (hasBlockingFlags(flags)) {
        setError(
          'This draft uses language we automatically block. Please re-record without profanity, slurs, threats, or harassment.'
        )
        setStage('preview')
        return
      }

      const supabase = createClient()
      const fileName = `audio/${Date.now()}.webm`

      if (audioBlob.size > 10 * 1024 * 1024) {
        setError('Recording is too large. Please keep it under 60 seconds.')
        setStage('preview')
        return
      }

      const { error: uploadError } = await supabase.storage
        .from('voice-notes')
        .upload(fileName, audioBlob, { contentType: 'audio/webm', upsert: false })

      if (uploadError) throw uploadError

      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioPath: fileName,
          audioDurationSec: elapsed,
          transcript: transcript || null,
          surveyAnswers: JSON.parse(surveyAnswers),
        }),
      })

      if (!res.ok) throw new Error('Submission failed')

      sessionStorage.removeItem('surveyAnswers')
      router.push('/submit/done')
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
      setStage('preview')
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-2xl font-bold">Record your voice note</h1>
        <p className="mb-8 text-sm text-zinc-500">
          {commonGroundPrompt}
        </p>
        <p className="mb-8 text-xs text-zinc-400">
          Keep it respectful. Recordings with profanity, slurs, threats, or harassment
          are blocked before submission.
        </p>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {stage === 'idle' && (
          <Button onClick={startRecording} className="w-full py-4 text-base">
            Start recording
          </Button>
        )}

        {stage === 'requesting' && (
          <p className="text-center text-sm text-zinc-500">
            Waiting for microphone permission...
          </p>
        )}

        {stage === 'recording' && (
          <div className="text-center">
            <div className="mb-4 font-mono text-5xl">
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}:
              {String(elapsed % 60).padStart(2, '0')}
            </div>
            <div className="mx-auto mb-6 h-3 w-3 animate-pulse rounded-full bg-red-500" />
            <div className="mb-6 text-xs text-zinc-400">{MAX_SECONDS - elapsed}s remaining</div>
            <Button onClick={stopRecording} variant="secondary" className="w-full py-3">
              Stop recording
            </Button>
          </div>
        )}

        {stage === 'preview' && audioUrl && (
          <div>
            <AudioPlayer src={audioUrl} label="Your recording" />

            <div className="mt-6 flex gap-3">
              <Button variant="secondary" onClick={discard} className="flex-1 py-3">
                Re-record
              </Button>
              <Button onClick={submit} className="flex-1 py-3">
                Submit
              </Button>
            </div>
          </div>
        )}

        {stage === 'submitting' && (
          <p className="text-center text-sm text-zinc-500">Submitting your voice note...</p>
        )}
      </div>
    </div>
  )
}
