alter table public.project_reviews
  add column if not exists reviewer text not null default '';
