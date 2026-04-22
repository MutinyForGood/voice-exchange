-- Run after schema is applied. Inserts approved test submissions.
-- Audio paths are fake; replace with real uploads when testing playback.

insert into submissions (status, survey_answers, audio_path, audio_duration_sec, transcript, moderation_flags)
values
  (
    'approved',
    '[
      {"questionId":"q1","answer":"agree"},
      {"questionId":"q2","answer":"disagree"},
      {"questionId":"q3","answer":"agree"},
      {"questionId":"q4","answer":"neutral"},
      {"questionId":"q5","answer":"agree"}
    ]',
    'audio/seed-001.webm',
    28.4,
    'I think we often talk past each other because we start from different assumptions about what fairness means. For me it comes down to whether people have a real shot, not just a theoretical one.',
    '[]'
  ),
  (
    'approved',
    '[
      {"questionId":"q1","answer":"disagree"},
      {"questionId":"q2","answer":"agree"},
      {"questionId":"q3","answer":"neutral"},
      {"questionId":"q4","answer":"disagree"},
      {"questionId":"q5","answer":"neutral"}
    ]',
    'audio/seed-002.webm',
    41.0,
    'What I want people on the other side to understand is that skepticism of government solutions is not the same as not caring. I care deeply. I just think there are better ways to help people.',
    '[]'
  ),
  (
    'approved',
    '[
      {"questionId":"q1","answer":"neutral"},
      {"questionId":"q2","answer":"agree"},
      {"questionId":"q3","answer":"agree"},
      {"questionId":"q4","answer":"agree"},
      {"questionId":"q5","answer":"disagree"}
    ]',
    'audio/seed-003.webm',
    35.2,
    'The thing I find hardest is that the news makes everyone seem like they are at the extremes. Most people I know personally are much more thoughtful than that, whatever their politics.',
    '[]'
  );
