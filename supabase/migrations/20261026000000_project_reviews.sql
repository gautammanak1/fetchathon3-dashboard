create table if not exists public.project_reviews (
  team_id text primary key,
  rating integer,
  score numeric,
  comment text not null default '',
  reviewer text not null default '',
  updated_at timestamptz not null default now(),
  constraint project_reviews_rating_check check (rating is null or (rating >= 1 and rating <= 10)),
  constraint project_reviews_score_check check (score is null or (score >= 0 and score <= 100))
);

alter table public.project_reviews enable row level security;
revoke all on table public.project_reviews from anon, authenticated;
grant select, insert, update, delete on table public.project_reviews to fetchathon_app;
