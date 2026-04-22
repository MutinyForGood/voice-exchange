import { ModerationFlag } from '@/types'

interface FlagRule {
  rule: string
  pattern: RegExp
}

const FLAG_RULES: FlagRule[] = [
  {
    rule: 'profanity',
    pattern: /\b(fuck|shit|ass|bitch|cunt|bastard|damn)\b/i,
  },
  {
    rule: 'violent_threat',
    pattern:
      /\b(kill|murder|shoot|stab|bomb|attack|hurt|destroy)\s+(you|them|he|she|those|these|all)\b/i,
  },
  {
    rule: 'slur',
    // Intentionally sparse — real implementation should use a curated list
    pattern: /\b(n[i1]gg[ae]r|f[a4]gg[o0]t|sp[i1]c|ch[i1]nk|k[i1]ke|w[e3]tb[a4]ck)\b/i,
  },
  {
    rule: 'doxxing_pattern',
    // Phone numbers, emails, and "address at" patterns
    pattern:
      /(\b\d{3}[-.]?\d{3}[-.]?\d{4}\b|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|\d+\s+\w+\s+(street|st|ave|avenue|blvd|road|rd|drive|dr|lane|ln)\b)/i,
  },
  {
    rule: 'harassment',
    pattern:
      /\b(you('re| are) (pathetic|worthless|disgusting|stupid|an idiot|a loser)|go (kill|hurt) yourself)\b/i,
  },
]

export function checkFlags(transcript: string): ModerationFlag[] {
  const flags: ModerationFlag[] = []
  for (const { rule, pattern } of FLAG_RULES) {
    const match = transcript.match(pattern)
    if (match) {
      flags.push({ rule, matchedText: match[0] })
    }
  }
  return flags
}

const BLOCKING_RULES = new Set(['profanity', 'slur', 'harassment', 'violent_threat'])

export function hasBlockingFlags(flags: ModerationFlag[]) {
  return flags.some((flag) => BLOCKING_RULES.has(flag.rule))
}
