create table if not exists public.lunch_pickups (
  registration_id text primary key,
  name text not null default '',
  email text not null default '',
  role text not null default '',
  organization text not null default '',
  team_key text not null default '',
  team_id_display text not null default '',
  venue text not null default '',
  token text not null default '',
  notion_page_id text not null default '',
  notion_created boolean not null default false,
  collected_at timestamptz not null default now()
);

create index if not exists lunch_pickups_team_idx on public.lunch_pickups (team_key);
create index if not exists lunch_pickups_collected_idx on public.lunch_pickups (collected_at desc);

alter table public.lunch_pickups enable row level security;
revoke all on table public.lunch_pickups from anon, authenticated;
grant select, insert, update, delete on table public.lunch_pickups to fetchathon_app;
