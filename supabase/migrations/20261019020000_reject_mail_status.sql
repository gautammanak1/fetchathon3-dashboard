alter table public.mail_people
  add column if not exists reject_status text not null default 'none',
  add column if not exists reject_sent_at timestamptz,
  add column if not exists reject_count integer not null default 0;

alter table public.mail_people drop constraint if exists mail_people_reject_status_check;
alter table public.mail_people
  add constraint mail_people_reject_status_check check (reject_status in ('none', 'sent'));

alter table public.mail_people drop constraint if exists mail_people_reject_count_check;
alter table public.mail_people
  add constraint mail_people_reject_count_check check (reject_count >= 0);
