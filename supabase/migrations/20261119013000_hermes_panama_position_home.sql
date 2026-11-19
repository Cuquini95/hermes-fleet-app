alter table public.hermes_memberships
  add column if not exists position_code text
  check (position_code is null or position_code ~ '^TP-PER-0(0[1-9]|1[0-9]|2[0-8])$');

comment on column public.hermes_memberships.position_code is
  'Puesto R06 del padrón F01 vigente. Selecciona el inicio de Panamá y conserva las facultades de la cuenta.';
