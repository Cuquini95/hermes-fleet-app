begin;

create table if not exists public.hermes_preview_operations (
  workspace text primary key check (workspace = 'panama-demo'),
  revision bigint not null check (revision >= 1),
  data jsonb not null check (jsonb_typeof(data) = 'object')
);

alter table public.hermes_preview_operations enable row level security;
revoke all on table public.hermes_preview_operations from public, anon, authenticated;
grant select, insert, update on table public.hermes_preview_operations to service_role;

commit;
