alter table public.feedback
  add column if not exists tech_feedback text not null default '',
  add column if not exists asi1_feedback text not null default '';
