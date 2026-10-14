create table public.mail_people (
  notion_id text primary key,
  email text not null default '',
  name text not null default '',
  team_id text not null default '',
  registration_mail_status text not null default 'none' check (registration_mail_status in ('none', 'sent')),
  registration_mail_sent_at timestamptz,
  registration_mail_count integer not null default 0 check (registration_mail_count >= 0),
  rsvp_status text not null default 'none' check (rsvp_status in ('none', 'sent', 'confirmed')),
  rsvp_sent_at timestamptz,
  rsvp_count integer not null default 0 check (rsvp_count >= 0),
  qr_status text not null default 'none' check (qr_status in ('none', 'generated', 'sent')),
  qr_token text,
  qr_generated_at timestamptz,
  qr_sent_at timestamptz,
  qr_count integer not null default 0 check (qr_count >= 0),
  updated_at timestamptz not null default now()
);

create index mail_people_email_idx on public.mail_people (lower(email));
create index mail_people_rsvp_status_idx on public.mail_people (rsvp_status);
create index mail_people_qr_status_idx on public.mail_people (qr_status);

alter table public.mail_people enable row level security;
revoke all on table public.mail_people from anon, authenticated;

create table public.checkins (
  registration_id text primary key,
  name text not null default '',
  email text not null default '',
  role text not null default '',
  organization text not null default '',
  team_key text not null default '',
  team_id_display text not null default '',
  venue text not null default '',
  checked_in_at timestamptz not null
);

alter table public.checkins enable row level security;
revoke all on table public.checkins from anon, authenticated;

create table public.mail_templates (
  id text primary key,
  name text not null,
  subject text not null,
  body text not null,
  updated_at timestamptz not null default now()
);

alter table public.mail_templates enable row level security;
revoke all on table public.mail_templates from anon, authenticated;
