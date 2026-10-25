alter table public.mail_send_jobs
  add column if not exists subject text not null default '';

alter table public.mail_send_jobs
  add column if not exists message text not null default '';
