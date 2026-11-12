begin;

create table if not exists public.hermes_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(btrim(email)) and length(email) between 3 and 254),
  user_name text not null check (length(btrim(user_name)) between 1 and 120),
  role text not null check (role in ('operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia')),
  projects text[] not null check (cardinality(projects) > 0 and array_position(projects, null) is null),
  assigned_units text[] not null default '{}' check (array_position(assigned_units, null) is null),
  unit_scope text not null check (unit_scope in ('all', 'assigned')),
  active boolean not null default true,
  can_approve_purchases boolean not null default false check (not can_approve_purchases or role = 'gerencia'),
  created_at timestamptz not null default now(),
  first_login_at timestamptz
);

create table if not exists public.hermes_sessions (
  session_hash text primary key check (session_hash ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references public.hermes_memberships(user_id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists hermes_sessions_user_id_idx on public.hermes_sessions(user_id);
create index if not exists hermes_sessions_expiry_idx on public.hermes_sessions(expires_at);

alter table public.hermes_memberships enable row level security;
alter table public.hermes_sessions enable row level security;
revoke all on table public.hermes_memberships, public.hermes_sessions from public, anon, authenticated;
grant select, insert, update on table public.hermes_memberships to service_role;
grant select, insert, delete on table public.hermes_sessions to service_role;

create or replace function public.hermes_record_first_login() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  update public.hermes_memberships
  set first_login_at = new.created_at
  where user_id = new.user_id and first_login_at is null;
  return new;
end;
$$;

revoke execute on function public.hermes_record_first_login() from public, anon, authenticated;
grant execute on function public.hermes_record_first_login() to service_role;

drop trigger if exists hermes_session_first_login on public.hermes_sessions;
create trigger hermes_session_first_login
after insert on public.hermes_sessions
for each row execute function public.hermes_record_first_login();

commit;
