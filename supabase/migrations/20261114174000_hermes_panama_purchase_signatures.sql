create table public.hermes_panama_purchase_signatures (
  folio text not null check (folio ~ '^OC-[A-Z0-9][A-Z0-9_-]{0,86}$'),
  approved_by_id uuid not null,
  approved_at timestamptz not null,
  png_base64 text not null check (
    char_length(png_base64) between 44 and 44000 and png_base64 ~ '^[A-Za-z0-9+/]+={0,2}$'
  ),
  primary key (folio, approved_by_id, approved_at)
);

alter table public.hermes_panama_purchase_signatures enable row level security;
revoke all on table public.hermes_panama_purchase_signatures from public, anon, authenticated, service_role;
grant select on table public.hermes_panama_purchase_signatures to service_role;
