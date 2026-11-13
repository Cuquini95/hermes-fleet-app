alter table public.hermes_memberships
  add column if not exists can_record_purchase_invoices boolean not null default false
  check (not can_record_purchase_invoices or (
    projects = array['tmf-panama']::text[] and role = 'gerencia'
    and not can_approve_purchases and not can_receive_purchases
  )),
  add column if not exists can_record_purchase_payments boolean not null default false
  check (not can_record_purchase_payments or (
    projects = array['tmf-panama']::text[] and role = 'gerencia'
    and not can_approve_purchases and not can_receive_purchases and not can_record_purchase_invoices
  ));
