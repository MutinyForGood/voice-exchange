create type submission_status as enum ('pending', 'approved', 'rejected');

create table submissions (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz default now(),
  status              submission_status not null default 'pending',
  survey_answers      jsonb not null,
  audio_path          text not null,
  audio_duration_sec  float,
  transcript          text,
  moderation_flags    jsonb not null default '[]'::jsonb,
  moderator_notes     text
);

create index idx_submissions_status     on submissions(status);
create index idx_submissions_created_at on submissions(created_at desc);

create table moderation_events (
  id             uuid primary key default gen_random_uuid(),
  submission_id  uuid not null references submissions(id) on delete cascade,
  created_at     timestamptz default now(),
  action         text not null,  -- 'approved' | 'rejected' | 'flagged'
  notes          text
);

create index idx_moderation_events_submission on moderation_events(submission_id);
