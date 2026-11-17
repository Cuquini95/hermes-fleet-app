create function public.hermes_panama_commit_signed_purchase(
  operation_key text, operation_fingerprint text, guards text[], changes jsonb, outcome jsonb,
  purchase_signature jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved jsonb;
  folio text := purchase_signature->>'folio';
  signer uuid := (purchase_signature->>'approvedById')::uuid;
  approved_at timestamptz := (purchase_signature->>'approvedAt')::timestamptz;
begin
  saved := public.hermes_panama_commit(operation_key, operation_fingerprint, guards, changes, outcome);
  if (saved->>'replayed')::boolean then return saved; end if;

  if folio is distinct from outcome->>'folio' or not exists (
    select 1 from public.hermes_panama_operational_tables t
    cross join lateral pg_catalog.jsonb_array_elements(t.rows) as orders(row)
    where t.name = 'Órdenes de Compra' and row->>0 = folio
      and row->>11 in ('Aprobada', 'Recibida parcial', 'Recibida', 'Pagada')
      and row->>17 = signer::text and row->>18 = purchase_signature->>'approvedAt'
  ) then
    raise sqlstate 'PT409' using message = 'La aprobación vigente no coincide con la firma.';
  end if;

  insert into public.hermes_panama_purchase_signatures (folio, approved_by_id, approved_at, png_base64)
  values (folio, signer, approved_at, purchase_signature->>'png') on conflict do nothing;
  if not found then
    raise sqlstate 'PT409' using message = 'La OC ya tiene firma archivada.';
  end if;
  return saved;
end;
$$;

revoke all on function public.hermes_panama_commit_signed_purchase(text, text, text[], jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.hermes_panama_commit_signed_purchase(text, text, text[], jsonb, jsonb, jsonb)
  to service_role;
