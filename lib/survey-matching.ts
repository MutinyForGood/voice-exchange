import { SurveyAnswer } from '@/types'

export function encodeSurveyAnswers(answers: SurveyAnswer[]) {
  return encodeURIComponent(JSON.stringify(answers))
}

export function decodeSurveyAnswers(raw: string | null): SurveyAnswer[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (item): item is SurveyAnswer =>
        item &&
        typeof item.questionId === 'string' &&
        ['agree', 'neutral', 'disagree'].includes(item.answer)
    )
  } catch {
    try {
      const parsed = JSON.parse(decodeURIComponent(raw))
      if (!Array.isArray(parsed)) return []

      return parsed.filter(
        (item): item is SurveyAnswer =>
          item &&
          typeof item.questionId === 'string' &&
          ['agree', 'neutral', 'disagree'].includes(item.answer)
      )
    } catch {
      return []
    }
  }
}

export function isOppositeAnswer(
  a: SurveyAnswer['answer'],
  b: SurveyAnswer['answer']
) {
  return (
    (a === 'agree' && b === 'disagree') || (a === 'disagree' && b === 'agree')
  )
}

export function buildOppositionSummary(
  yours: SurveyAnswer[],
  theirs: SurveyAnswer[]
) {
  const theirMap = new Map(theirs.map((answer) => [answer.questionId, answer.answer]))

  return yours.flatMap((answer) => {
    const theirAnswer = theirMap.get(answer.questionId)
    if (!theirAnswer || !isOppositeAnswer(answer.answer, theirAnswer)) return []

    return [
      {
        questionId: answer.questionId,
        yourAnswer: answer.answer,
        theirAnswer,
      },
    ]
  })
}
