alter table public.lunch_pickups
  add column if not exists notion_page_id text not null default '';

alter table public.lunch_pickups
  add column if not exists notion_created boolean not null default false;
