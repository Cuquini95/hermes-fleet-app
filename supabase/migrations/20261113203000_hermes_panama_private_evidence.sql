create table if not exists public.hermes_panama_evidence (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  actor_id uuid not null,
  kind text not null check (kind in ('report', 'dvir', 'sticker', 'order', 'receipt')),
  operation_id uuid not null,
  slot smallint not null check (slot between 0 and 39 and (kind <> 'receipt' or slot = 0)),
  units text[] not null check (cardinality(units) between 1 and 100 and (kind = 'receipt' or cardinality(units) = 1)),
  record_id text not null check ((kind = 'order' and record_id ~* '^OT-[a-z0-9][a-z0-9_-]{0,86}$') or (kind <> 'order' and record_id = '')),
  preview_demo boolean not null,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp') or (kind = 'receipt' and mime_type = 'application/pdf')),
  byte_size integer not null check (byte_size between 1 and 3145728),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  ready boolean not null default false,
  created_at timestamptz not null default now(),
  unique (actor_id, preview_demo, kind, operation_id, slot)
);

alter table public.hermes_panama_evidence enable row level security;
revoke all on table public.hermes_panama_evidence from public, anon, authenticated, service_role;
grant select, insert on table public.hermes_panama_evidence to service_role;
grant update (ready) on table public.hermes_panama_evidence to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hermes-panama-evidence', 'hermes-panama-evidence', false, 3145728,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy hermes_panama_evidence_service_only
  on storage.objects as restrictive for all to anon, authenticated
  using (bucket_id <> 'hermes-panama-evidence')
  with check (bucket_id <> 'hermes-panama-evidence');
