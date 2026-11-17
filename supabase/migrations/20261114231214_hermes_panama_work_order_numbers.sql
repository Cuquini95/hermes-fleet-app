begin;

-- Share the transaction lock with Hermes operational writes during the backfill.
select pg_catalog.pg_advisory_xact_lock(863019441);

with entries as (
  select entry.value, entry.position
  from public.hermes_panama_operational_tables t
  cross join lateral pg_catalog.jsonb_array_elements(t.rows) with ordinality entry(value, position)
  where t.name = 'ORDENES_TRABAJO'
), numbered as (
  select value, position,
    greatest(99, coalesce(max(case when value->>25 ~ '^OT-[0-9]{4,15}$'
      then pg_catalog.substr(value->>25, 4)::bigint end) over (), 99))
    + count(*) filter (
      where position > 1 and value->>1 like 'OT-%'
        and coalesce(value->>25, '') !~ '^OT-[0-9]{4,15}$'
    ) over (order by position) as number
  from entries
), backfill as (
  select pg_catalog.jsonb_agg(
    case when position = 1 or (value->>1 like 'OT-%' and coalesce(value->>25, '') !~ '^OT-[0-9]{4,15}$') then
      pg_catalog.jsonb_set(
        value || coalesce((select pg_catalog.jsonb_agg(''::text) from pg_catalog.generate_series(pg_catalog.jsonb_array_length(value), 24)), '[]'::jsonb),
        '{25}', pg_catalog.to_jsonb(case when position = 1 then 'FOLIO_OT'
          else 'OT-' || pg_catalog.lpad(number::text, greatest(4, char_length(number::text)), '0') end)
      )
    else value end order by position
  ) as rows
  from numbered
)
update public.hermes_panama_operational_tables t set rows = backfill.rows
from backfill
where t.name = 'ORDENES_TRABAJO' and backfill.rows is not null and t.rows is distinct from backfill.rows;

create or replace function public.hermes_panama_number_new_work_orders()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_number bigint;
  row_index integer;
  entry jsonb;
  folio text;
begin
  -- The work order row is locked by the UPDATE. A rolled-back append consumes no number.
  select greatest(99, max(pg_catalog.substr(r.value->>25, 4)::bigint)) into next_number
  from pg_catalog.jsonb_array_elements(old.rows) r(value)
  where r.value->>25 ~ '^OT-[0-9]{4,15}$';

  for row_index in pg_catalog.jsonb_array_length(old.rows)..pg_catalog.jsonb_array_length(new.rows) - 1 loop
    entry := new.rows->row_index;
    if coalesce(entry->>1, '') not like 'OT-%' then continue; end if;
    next_number := next_number + 1;
    folio := 'OT-' || pg_catalog.lpad(next_number::text, greatest(4, char_length(next_number::text)), '0');
    while pg_catalog.jsonb_array_length(entry) < 25 loop
      entry := entry || '[""]'::jsonb;
    end loop;
    new.rows := pg_catalog.jsonb_set(new.rows, array[row_index::text],
      pg_catalog.jsonb_set(entry, '{25}', pg_catalog.to_jsonb(folio)), false);
  end loop;
  return new;
end;
$$;

revoke all on function public.hermes_panama_number_new_work_orders() from public, anon, authenticated, service_role;
grant execute on function public.hermes_panama_number_new_work_orders() to service_role;

drop trigger if exists hermes_panama_number_new_work_orders on public.hermes_panama_operational_tables;

create trigger hermes_panama_number_new_work_orders
before update of rows on public.hermes_panama_operational_tables
for each row when (old.name = 'ORDENES_TRABAJO' and pg_catalog.jsonb_array_length(new.rows) > pg_catalog.jsonb_array_length(old.rows))
execute function public.hermes_panama_number_new_work_orders();

commit;
