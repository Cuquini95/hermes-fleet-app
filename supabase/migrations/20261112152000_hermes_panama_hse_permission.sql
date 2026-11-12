alter table public.hermes_memberships
  add column if not exists can_review_panama_hse boolean not null default false
  check (not can_review_panama_hse or (projects = array['tmf-panama']::text[] and role in ('supervisor', 'gerencia')));
