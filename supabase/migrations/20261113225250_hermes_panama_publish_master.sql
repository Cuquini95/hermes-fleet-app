create or replace function public.hermes_panama_publish_master(
  p_source text,
  p_captured_at timestamptz,
  p_rows jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog
as $function$
declare
  spec record;
  column_names text[];
  column_count integer;
  unit_column integer;
  id_column integer;
  country_column integer;
  project_column integer;
  fleet_rows jsonb;
  fleet_unit_column integer;
  fleet_units text[];
  incoming_rows jsonb := p_rows;
  stored_at timestamptz;
  stored_rows jsonb;
begin
  select * into spec
  from (values
    ('fleet', 'codigo', null, 6, false,
      array['codigo', 'equipo', 'modelo', 'clase contractual', 'activo'], array[]::text[]),
    ('shifts', 'codigo', 'clave', 13, false,
      array['clave', 'codigo', 'fecha', 'turno', 'estado', 'h. inicial', 'h. final'], array[]::text[]),
    ('failures', 'equipo', 'caso', 11, true,
      array['caso', 'equipo', 'falla reportada', 'estado', 'ultimo reporte', 'ot vinculada'], array[]::text[]),
    ('orders', 'equipo', 'nº ot', 22, true,
      array['nº ot', 'equipo', 'falla / trabajo a realizar', 'estado', 'control integridad ot'], array[]::text[]),
    ('maintenance', 'equipo', null, 14, false,
      array['equipo', '¿como esta?', 'proximo pm', 'horas que le quedan', 'lectura', 'plan'],
      array['modelo', 'toca a las (h)', 'horometro hoy', 'ultimo pm anotado']),
    ('maintenancePlan', 'equipo', null, 13, false,
      array['equipo', 'modelo', '¿activo?', 'pm cada (h)', 'nivel 2 (h)', 'nivel 3 (h)', 'nivel 4 (h)',
            'nivel 5 (h)', 'nivel 6 (h)', '¿plan aprobado?', 'paquete / checklist (link)'], array[]::text[]),
    ('maintenanceAnchor', 'equipo', null, 34, false, array['equipo', 'ancla ciclo (h)'], array[]::text[]),
    ('dozers', 'equipo', null, 10, false, array['equipo', 'tipo', '🔴', '🟠', '⚪ sin dato'], array[]::text[]),
    ('excavators', 'equipo', null, 10, false, array['equipo', 'tipo', '🔴', '🟠', '⚪ sin dato'], array[]::text[]),
    ('dozerChanges', 'equipo', null, 17, true,
      array['equipo', 'fecha', 'pieza', 'lado / posicion', 'horometro al cambio (h)', '¿por que se cambio?',
            '¿bien anotado?', 'horas que duro la pieza'], array[]::text[]),
    ('excavatorChanges', 'equipo', null, 17, true,
      array['equipo', 'fecha', 'pieza', 'lado / posicion', 'horometro al cambio (h)', '¿por que se cambio?',
            '¿bien anotado?', 'horas que duro la pieza'], array[]::text[]),
    ('dozerLife', 'equipo', null, 17, false,
      array['equipo', 'pieza', 'lado', 'vida', 'ulthor', 'horact', 'usadas', 'restantes', 'estado'], array[]::text[]),
    ('excavatorLife', 'equipo', null, 17, false,
      array['equipo', 'pieza', 'lado', 'vida', 'ulthor', 'horact', 'usadas', 'restantes', 'estado'], array[]::text[]),
    ('purchases', 'equipo / item', 'id', 26, true,
      array['id', 'pais', 'equipo / item', 'descripcion', 'monto', 'moneda', 'estado operativo', 'oc',
            'control recepcion'], array[]::text[]),
    ('costs', 'unidad', null, 12, false,
      array['unidad', 'horas tmf', 'ingreso usd', 'compras + reparto usd',
            'costo analitico parcial usd/h', 'margen analitico parcial usd/h'], array[]::text[]),
    ('equipmentDetails', 'codigo', null, 13, false,
      array['codigo', 'pais', 'proyecto', 'tipo', 'marca', 'modelo', 'serie'], array[]::text[])
  ) as sources(source, unit_header, id_header, max_columns, empty_allowed, required_headers, optional_headers)
  where sources.source = p_source;

  if not found then
    raise exception using errcode = '22023', message = 'Unknown Hermes Panama master source';
  end if;
  if p_captured_at is null or not isfinite(p_captured_at)
    or p_captured_at > statement_timestamp() + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'Invalid Hermes Panama capture time';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Expected Hermes Panama row array';
  end if;
  if jsonb_array_length(p_rows) not between (case when spec.empty_allowed then 1 else 2 end) and 1600
    or octet_length(p_rows::text) > 2097152
    or jsonb_typeof(p_rows -> 0) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Invalid Hermes Panama snapshot size';
  end if;

  column_count := jsonb_array_length(p_rows -> 0);
  if column_count < cardinality(spec.required_headers) or column_count > spec.max_columns
    or exists (
      select 1 from jsonb_array_elements(p_rows) as entry(row_data)
      where case when jsonb_typeof(entry.row_data) = 'array'
        then jsonb_array_length(entry.row_data) <> column_count else true end
    ) then
    raise exception using errcode = '22023', message = 'Invalid Hermes Panama row shape';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_rows) as entry(row_data)
    cross join lateral jsonb_array_elements(entry.row_data) as item(cell)
    where jsonb_typeof(item.cell) <> 'string'
  ) then
    raise exception using errcode = '22023', message = 'Hermes Panama snapshot cells must be strings';
  end if;

  select array_agg(
    lower(translate(normalize(btrim(item.cell)), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))
    order by item.ordinality
  )
  into column_names
  from jsonb_array_elements_text(p_rows -> 0) with ordinality as item(cell, ordinality);

  -- Keep the live PM sheet heading compatible with published readers.
  if p_source = 'maintenance' and 'estado' = any(column_names) then
    incoming_rows := jsonb_set(p_rows, array['0', (array_position(column_names, 'estado') - 1)::text],
      to_jsonb('¿CÓMO ESTÁ?'::text));
    column_names := array_replace(column_names, 'estado', '¿como esta?');
  end if;

  if not (spec.required_headers <@ column_names)
    or not (column_names <@ (spec.required_headers || spec.optional_headers || array['']))
    or exists (
      select 1 from unnest(column_names) as header(name)
      where header.name <> ''
      group by header.name
      having count(*) > 1
    ) then
    raise exception using errcode = '22023', message = 'Unexpected Hermes Panama snapshot columns';
  end if;
  if '' = any(column_names) and exists (
    select 1
    from jsonb_array_elements_text(p_rows -> 0) with ordinality as header(cell, ordinality)
    cross join lateral jsonb_array_elements(p_rows) with ordinality as entry(row_data, row_number)
    where btrim(header.cell) = '' and entry.row_number > 1
      and btrim(entry.row_data ->> (header.ordinality::integer - 1)) <> ''
  ) then
    raise exception using errcode = '22023', message = 'Unexpected data in a blank Hermes Panama column';
  end if;

  unit_column := array_position(column_names, spec.unit_header) - 1;
  id_column := array_position(column_names, spec.id_header) - 1;
  country_column := array_position(column_names, 'pais') - 1;
  project_column := array_position(column_names, 'proyecto') - 1;
  if exists (
    select 1
    from jsonb_array_elements(p_rows) with ordinality as entry(row_data, row_number)
    where entry.row_number > 1
      and (upper(btrim(entry.row_data ->> unit_column)) !~ '^[A-Z]{1,7}[- ]?[0-9]{1,7}$'
        or (id_column is not null and btrim(entry.row_data ->> id_column) = '')
        or (country_column is not null
          and lower(translate(normalize(btrim(entry.row_data ->> country_column)), 'Áá', 'Aa')) <> 'panama')
        or (project_column is not null
          and lower(translate(normalize(btrim(entry.row_data ->> project_column)), 'Áá', 'Aa'))
            not in ('tmf', 'tmf minera panama')))
  ) then
    raise exception using errcode = '22023', message = 'Hermes Panama snapshot has out-of-scope rows';
  end if;

  if p_source in ('costs', 'orders', 'equipmentDetails') and jsonb_array_length(p_rows) > 1 then
    -- Prevent a concurrent fleet update from changing scope during publication.
    select snapshot.rows into fleet_rows
    from public.hermes_panama_source_snapshots as snapshot
    where snapshot.source = 'fleet'
    for share;

    select (header.ordinality - 1)::integer into fleet_unit_column
    from jsonb_array_elements_text(fleet_rows -> 0) with ordinality as header(cell, ordinality)
    where lower(translate(normalize(btrim(header.cell)), 'Óó', 'Oo')) = 'codigo';

    select array_agg(upper(btrim(entry.row_data ->> fleet_unit_column))) into fleet_units
    from jsonb_array_elements(fleet_rows) with ordinality as entry(row_data, row_number)
    where entry.row_number > 1 and entry.row_data ->> fleet_unit_column is not null;

    if fleet_units is null or exists (
      select 1
      from jsonb_array_elements(p_rows) with ordinality as entry(row_data, row_number)
      where entry.row_number > 1
        and not (upper(btrim(entry.row_data ->> unit_column)) = any(fleet_units))
    ) then
      raise exception using errcode = '22023', message = 'Hermes Panama snapshot has units outside the published fleet';
    end if;
  end if;

  -- The conflicting row stays locked even when the timestamp condition prevents an update.
  insert into public.hermes_panama_source_snapshots as current_snapshot (source, captured_at, rows)
  values (p_source, p_captured_at, incoming_rows)
  on conflict (source) do update
    set captured_at = excluded.captured_at, rows = excluded.rows
    where current_snapshot.captured_at < excluded.captured_at;
  if found then
    return true;
  end if;

  select snapshot.captured_at, snapshot.rows
    into stored_at, stored_rows
    from public.hermes_panama_source_snapshots as snapshot
    where snapshot.source = p_source;
  if stored_at = p_captured_at and stored_rows = incoming_rows then
    return false;
  end if;
  raise exception using errcode = '22023', message = 'Hermes Panama capture is stale or conflicts with an existing capture';
end;
$function$;

revoke all on function public.hermes_panama_publish_master(text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.hermes_panama_publish_master(text, timestamptz, jsonb) to service_role, postgres;
notify pgrst, 'reload schema';
