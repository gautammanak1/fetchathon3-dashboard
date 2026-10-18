alter table public.mail_people
  add column if not exists phone text not null default '',
  add column if not exists role text not null default '',
  add column if not exists organization text not null default '',
  add column if not exists participation text not null default '',
  add column if not exists are_you text not null default '',
  add column if not exists city text not null default '',
  add column if not exists skills text not null default '',
  add column if not exists experience text not null default '',
  add column if not exists github text not null default '',
  add column if not exists linkedin text not null default '',
  add column if not exists address text not null default '',
  add column if not exists team_size text not null default '',
  add column if not exists registration_status text not null default '';

create index if not exists mail_people_team_id_idx on public.mail_people (team_id);
