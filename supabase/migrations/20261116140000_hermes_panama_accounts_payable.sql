insert into public.hermes_panama_operational_tables (name, rows)
values
  ('HERMES_PA_FACTURAS_OC', '[["ID","OC_ID","DETALLE_JSON"]]'::jsonb),
  ('HERMES_PA_PAGOS_FACTURA', '[["ID","FACTURA_ID","DETALLE_JSON"]]'::jsonb)
on conflict (name) do nothing;

-- A deployment rollback can still read and receive existing OCs. Once the
-- independent invoice ledger has entries, old clients cannot add a second
-- financial record to the original OC columns.
create function public.hermes_panama_guard_legacy_purchase_ap()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.hermes_panama_operational_tables ledger
    cross join lateral pg_catalog.jsonb_array_elements(ledger.rows) as invoices(invoice)
    join lateral (
      select item
      from pg_catalog.jsonb_array_elements(new.rows) as changed(item)
      where item->>0 = invoice->>1
    ) as current_order on true
    join lateral (
      select item
      from pg_catalog.jsonb_array_elements(old.rows) as previous(item)
      where item->>0 = invoice->>1
    ) as previous_order on true
    where ledger.name = 'HERMES_PA_FACTURAS_OC'
      and (current_order.item->23 is distinct from previous_order.item->23
        or current_order.item->24 is distinct from previous_order.item->24)
  ) then
    raise sqlstate 'PT409' using message = 'La OC tiene facturas en Cuentas por pagar.';
  end if;
  return new;
end;
$$;

revoke all on function public.hermes_panama_guard_legacy_purchase_ap() from public, anon, authenticated;
grant execute on function public.hermes_panama_guard_legacy_purchase_ap() to service_role;

create trigger hermes_panama_guard_legacy_purchase_ap
before update of rows on public.hermes_panama_operational_tables
for each row when (old.name = 'Órdenes de Compra' and new.rows is distinct from old.rows)
execute function public.hermes_panama_guard_legacy_purchase_ap();
