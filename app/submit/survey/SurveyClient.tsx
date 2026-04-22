'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QUESTIONS } from '@/lib/questions'
import { SurveyAnswer } from '@/types'
import { ProgressBar } from '@/components/ProgressBar'
import { Button } from '@/components/Button'

type Answer = 'agree' | 'neutral' | 'disagree'

const OPTIONS: { value: Answer; label: string }[] = [
  { value: 'agree', label: 'Agree' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'disagree', label: 'Disagree' },
]

export function SurveyClient() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const question = QUESTIONS[step]
  const selected = answers[question.id]

  const handleAnswer = (value: Answer) => {
    setAnswers((prev) => ({ ...prev, [question.id]: value }))
  }

  const handleNext = () => {
    if (!selected) return
    if (step < QUESTIONS.length - 1) {
      setStep((s) => s + 1)
    } else {
      const surveyAnswers: SurveyAnswer[] = QUESTIONS.map((q) => ({
        questionId: q.id,
        answer: answers[q.id],
      }))
      sessionStorage.setItem('surveyAnswers', JSON.stringify(surveyAnswers))
      router.push('/submit/record')
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <ProgressBar current={step + 1} total={QUESTIONS.length} />
        </div>

        <h2 className="mb-8 text-xl leading-snug font-semibold">{question.text}</h2>

        <div className="mb-10 flex flex-col gap-3">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleAnswer(opt.value)}
              className={`w-full rounded-xl border-2 px-5 py-4 text-left text-sm font-medium transition-colors ${
                selected === opt.value
                  ? 'border-zinc-900 bg-zinc-900 text-white'
                  : 'border-zinc-200 hover:border-zinc-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Button onClick={handleNext} disabled={!selected} className="w-full py-3">
          {step < QUESTIONS.length - 1 ? 'Next' : 'Continue to recording'}
        </Button>
      </div>
    </div>
  )
}
