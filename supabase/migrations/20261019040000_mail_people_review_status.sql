alter table public.mail_people
  add column if not exists review_status text not null default 'pending';

alter table public.mail_people
  drop constraint if exists mail_people_review_status_check;

alter table public.mail_people
  add constraint mail_people_review_status_check
  check (review_status in ('pending', 'reviewed'));
