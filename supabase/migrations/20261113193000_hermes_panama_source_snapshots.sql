create table if not exists public.hermes_panama_source_snapshots (
  source text primary key,
  captured_at timestamptz not null,
  rows jsonb not null check (jsonb_typeof(rows) = 'array')
);

alter table public.hermes_panama_source_snapshots enable row level security;
revoke all on table public.hermes_panama_source_snapshots from public, anon, authenticated;
grant select, insert, update on table public.hermes_panama_source_snapshots to service_role;
