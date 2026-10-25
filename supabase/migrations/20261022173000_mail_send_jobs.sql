create table if not exists public.mail_send_jobs (
  id text primary key,
  kind text not null,
  mode text not null,
  force boolean not null default false,
  only_selected boolean not null default false,
  ids text[] not null,
  sent_ids text[] not null default '{}',
  failed_count integer not null default 0,
  attempt integer not null default 0,
  status text not null default 'running',
  note text not null default '',
  subject text not null default '',
  message text not null default '',
  total integer not null default 0,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mail_send_jobs_status_idx
  on public.mail_send_jobs (kind, status);

alter table public.mail_send_jobs enable row level security;
revoke all on table public.mail_send_jobs from anon, authenticated;
grant select, insert, update, delete on table public.mail_send_jobs to fetchathon_app;
