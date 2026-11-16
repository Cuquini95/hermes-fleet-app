create table public.hermes_panama_purchase_signature_profiles (
  approver_id uuid primary key,
  source_folio text not null,
  source_approved_at timestamptz not null,
  registered_at timestamptz not null default now(),
  foreign key (source_folio, approver_id, source_approved_at)
    references public.hermes_panama_purchase_signatures (folio, approved_by_id, approved_at)
);

alter table public.hermes_panama_purchase_signature_profiles enable row level security;
revoke all on table public.hermes_panama_purchase_signature_profiles from public, anon, authenticated, service_role;
grant select on table public.hermes_panama_purchase_signature_profiles to service_role;
