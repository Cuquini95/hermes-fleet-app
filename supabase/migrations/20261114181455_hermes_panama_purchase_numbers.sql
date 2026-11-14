begin;

-- Serialize the backfill with the operational writes that append orders.
select pg_catalog.pg_advisory_xact_lock(863019441);

with numbered as (
  select r.value, r.position,
    3000 + count(*) filter (where r.position > 1 and btrim(coalesce(r.value->>0, '')) <> '')
      over (order by r.position) as number
  from public.hermes_panama_operational_tables t
  cross join lateral jsonb_array_elements(t.rows) with ordinality r(value, position)
  where t.name = 'Órdenes de Compra'
), backfill as (
  select jsonb_agg(
    case when position = 1 or btrim(coalesce(value->>0, '')) <> '' then
      jsonb_set(
        value || coalesce((select jsonb_agg(''::text) from generate_series(jsonb_array_length(value), 26)), '[]'::jsonb),
        '{27}', to_jsonb(case when position = 1 then 'NUMERO_OC' else number::text end)
      )
    else value end
    order by position
  ) as rows
  from numbered
)
update public.hermes_panama_operational_tables t set rows = backfill.rows
from backfill
where t.name = 'Órdenes de Compra' and backfill.rows is not null;

create function public.hermes_panama_number_new_purchases()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_number bigint;
  row_index integer;
  entry jsonb;
begin
  -- Compra eliminada se conserva como fila con estado Eliminada, con su número reservado.
  select greatest(3000, max((r.value->>27)::bigint)) into next_number
  from pg_catalog.jsonb_array_elements(old.rows) r(value)
  where r.value->>27 ~ '^[1-9][0-9]{3,14}$';

  for row_index in pg_catalog.jsonb_array_length(old.rows)..pg_catalog.jsonb_array_length(new.rows) - 1 loop
    entry := new.rows->row_index;
    if pg_catalog.btrim(coalesce(entry->>0, '')) = '' then continue; end if;
    next_number := next_number + 1;
    while pg_catalog.jsonb_array_length(entry) < 27 loop
      entry := entry || '[""]'::jsonb;
    end loop;
    new.rows := pg_catalog.jsonb_set(new.rows, array[row_index::text],
      pg_catalog.jsonb_set(entry, '{27}', pg_catalog.to_jsonb(next_number::text)), false);
  end loop;
  return new;
end;
$$;

revoke all on function public.hermes_panama_number_new_purchases() from public, anon, authenticated, service_role;
grant execute on function public.hermes_panama_number_new_purchases() to service_role;

create trigger hermes_panama_number_new_purchases
before update of rows on public.hermes_panama_operational_tables
for each row when (old.name = 'Órdenes de Compra' and jsonb_array_length(new.rows) > jsonb_array_length(old.rows))
execute function public.hermes_panama_number_new_purchases();

commit;
