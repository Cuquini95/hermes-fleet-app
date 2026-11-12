alter table public.hermes_memberships
  add column if not exists can_receive_purchases boolean not null default false
  check (not can_receive_purchases or projects = array['tmf-panama']::text[]);
