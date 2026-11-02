create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null default '',
  email text not null default '',
  team_id text not null default '',
  city text not null default '',
  role text not null default '',
  rating integer,
  went_well text not null default '',
  problems text not null default '',
  problem_areas text[] not null default '{}',
  use_again text not null default '',
  fix_next text not null default '',
  tech_feedback text not null default '',
  asi1_feedback text not null default '',
  anything_else text not null default '',
  payload jsonb not null default '{}'::jsonb,
  constraint feedback_rating_check check (rating is null or (rating >= 1 and rating <= 5)),
  constraint feedback_use_again_check check (use_again in ('', 'yes', 'maybe', 'no'))
);

alter table public.feedback enable row level security;

revoke all on table public.feedback from anon, authenticated;

grant select, insert on table public.feedback to fetchathon_app;
