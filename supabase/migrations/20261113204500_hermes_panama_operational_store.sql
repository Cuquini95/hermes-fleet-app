begin;

create table if not exists public.hermes_panama_operational_tables (
  name text primary key,
  rows jsonb not null check (jsonb_typeof(rows) = 'array' and jsonb_array_length(rows) > 0)
);

create table if not exists public.hermes_panama_commit_receipts (
  operation_key text primary key,
  fingerprint text not null,
  result jsonb not null,
  saved_at timestamptz not null default now()
);

create table if not exists public.hermes_panama_write_guards (
  guard text primary key,
  operation_key text not null references public.hermes_panama_commit_receipts(operation_key)
);

alter table public.hermes_panama_operational_tables enable row level security;
alter table public.hermes_panama_commit_receipts enable row level security;
alter table public.hermes_panama_write_guards enable row level security;

revoke all on public.hermes_panama_operational_tables, public.hermes_panama_commit_receipts, public.hermes_panama_write_guards
  from public, anon, authenticated, service_role;
grant select, update on public.hermes_panama_operational_tables to service_role;
grant select, insert on public.hermes_panama_commit_receipts, public.hermes_panama_write_guards to service_role;

insert into public.hermes_panama_operational_tables (name, rows) values
  ('Averías', '[["FECHA","HORA","UNIDAD","TIPO_AVERIA","DESCRIPCION","SEVERIDAD","OPERADOR","TIEMPO_PARO","COSTO_ESTIMADO","ESTADO","SOLUCION","OBSERVACIONES","PROVEEDOR_PIEZA","OT_ID","FOTO_URL","ACTOR_ID"]]'),
  ('ORDENES_TRABAJO', '[["ROW_ID","OT_ID","FECHA","UNIDAD","TIPO_AVERIA","DESCRIPCION","SEVERIDAD","PRIORIDAD","MECANICO","ESTADO","FOTO_URL","AVERIA_REF","PARTES","COSTO_ESTIMADO","FECHA_CIERRE","OBSERVACIONES","PROGRESO","MECANICO_ID","VERSION","ACTOR_ID","EJECUCION","REVISION_TALLER","RETORNO","PM","OT_ANTERIOR"]]'),
  ('OT_STATUS_LOG', '[["TIMESTAMP","OT_ID","CAMPO","ANTES","DESPUES","ACTOR","ROL","ACTOR_ID"]]'),
  ('WORKSHOP_SCHEDULE', '[["ID","FECHA","OT_ID","UNIDAD","MECANICO","HORAS","PRIORIDAD","ESTADO","NOTAS","MECANICO_ID","ACTOR_ID"]]'),
  ('14 Inspecciones', '[["ID","FOLIO","FECHA","HORA","UNIDAD","MODELO","OPERADOR","TIPO","HOROMETRO","MOTOR","TRANSMISION","FRENOS","DIRECCION","HIDRAULICO","ELECTRICO","NEUMATICOS","ESTRUCTURA","LUCES","FLUIDOS","CABINA","TREN_DE_RODAJE","PUNTAJE","RESULTADO","OBSERVACIONES","FOTOS","OT_ID","ESTADO_OT","ACTOR","ACTOR_ID"]]'),
  ('Inspeccion_Stickers', '[["#","FOLIO","TIMESTAMP","FECHA","HORA","UNIDAD","MODELO","TIPO_EQUIPO","INSPECTOR","SUPERVISOR","ESTADO_APROBACION","COLOR_RECOMENDADO","COLOR_FINAL","PUEDE_DESPACHAR","VENCE","HALLAZGOS","FOTOS","DETALLE_JSON","INSPECTOR_ID","SUPERVISOR_ID","FECHA_APROBACION"]]'),
  ('Inspeccion_Hallazgos', '[["#","FOLIO","TIMESTAMP","UNIDAD","MODELO","TIPO_EQUIPO","SECCION","ITEM_ID","ITEM","ESTADO","COMENTARIO","FECHA_COMPROMISO","PUEDE_OPERAR","SEVERIDAD","ESTADO_APROBACION","VENCE","ACTOR_ID"]]'),
  ('Ordenes Mantenimiento', '[["OT_ID","FECHA","UNIDAD","MODELO","NIVEL","NIVELES_INCLUIDOS","HOROMETRO","DESCRIPCION","HORAS","MECANICO","ACTOR","ESTADO","PARTES","OBSERVACIONES","FECHA_EJECUCION","REVISOR_ID","REVISOR","FECHA_ACEPTACION","CHECKLIST"]]'),
  ('05 Historial PM', '[["FECHA","OT_ID","UNIDAD","MODELO","NIVEL","NIVELES_INCLUIDOS","HOROMETRO","HORAS","MECANICO","ACTOR","ESTADO","PARTES","OBSERVACIONES","FECHA_EJECUCION","REVISOR_ID","REVISOR","FECHA_ACEPTACION","CHECKLIST"]]'),
  ('04B Registro Horómetros', '[["FECHA","HORA","UNIDAD","MODELO","OPERADOR","TURNO","HOROMETRO","PROXIMO_PM","FALTAN","ACTOR_ID"]]'),
  ('HERMES_PA_TURNOS', '[["FOLIO","UNIDAD","FECHA","TURNO","VERSION","ESTADO_PARTE","HOROMETRO_INICIAL","HOROMETRO_FINAL","HORAS","ESTADO_EQUIPO","REFERENCIA_SOPORTE","VIAJES","TONELADAS","PARADAS","CLIENTE","AUTOR_ID","AUTOR","ACTOR_ID","ACTOR","FECHA_UTC","ACCION","COMENTARIO"]]'),
  ('HERMES_PA_DESPACHO', '[["FOLIO","UNIDAD","FECHA","TURNO","SITIO","OPERADOR_ID","OPERADOR","ACTOR_ID","ACTOR","FECHA_UTC"]]'),
  ('HERMES_PA_ESTADO_UNIDAD', '[["UNIDAD","REVISION","FECHA_UTC"]]'),
  ('Combustible', '[["Despachos de combustible"],["ID","FECHA","HORA","UNIDAD","OPERADOR","TIPO","LITROS","COSTO","HOROMETRO","KM","RENDIMIENTO","ESTACION","OBSERVACIONES","ACTOR_ID"]]'),
  ('Reporte_Fletes_Transporte', '[["FECHA","HORA","UNIDAD","OPERADOR","KM_CARGADO","KM_VACIO","ORIGEN","DESTINO","KM_TOTAL","CLIENTE","MATERIAL","TONELAJE","FLETE","OBSERVACIONES","FOLIO","ACTOR_ID"]]'),
  ('Reporte_Viajes_Peña', '[["ID","FECHA","TURNO","UNIDAD"]]'),
  ('Turnos', '[["ID","FECHA","TURNO","UNIDAD"]]'),
  ('Incidentes', '[["ID","FECHA","HORA","UNIDAD"]]'),
  ('13 Neumáticos', '[["ID","UNIDAD","MODELO","POSICION","MARCA_NEUMATICO","MODELO_NEUMATICO","MEDIDA","SERIE","FECHA_INSTALACION","HOROMETRO_INSTALACION","HOROMETRO_ACTUAL","HORAS_USO","PROFUNDIDAD_ORIGINAL","PROFUNDIDAD_ACTUAL","DESGASTE","PRESION_RECOMENDADA","PRESION_ACTUAL","FECHA_INSPECCION","ESTADO","","","","","","","OBSERVACIONES"]]'),
  ('Cotizaciones_Pendientes', '[["FECHA","PART_NUMBER","DESCRIPCION","EQUIPO","CANTIDAD","FUENTE","ESTADO","PRECIO_CATALOGO","URL","PEDIDO_ID","HORA","SOLICITANTE","URGENCIA","NOTAS","TOTAL","PARTIDA_ID","OC_ID","VERSION","SOLICITANTE_ID","ESTADO_ANTERIOR","FECHA_UTC","PRECIO_UNITARIO"]]'),
  ('Órdenes de Compra', '[["OC_ID","FECHA","PROVEEDOR","IDENTIFICACION_FISCAL","DIRECCION","UNIDAD","SUBTOTAL","ITBMS","ENVIO","OTROS","TOTAL","ESTADO","COMENTARIOS","APROBADA_POR","FECHA_ENTREGA","VERSION","EMISOR","APROBADOR_ID","FECHA_APROBACION","SOLICITANTE_ID","SOLICITANTE","OPERACION","MOTIVO_APROBACION","FACTURA","PAGO","DESCUENTO","ORIGEN_PROVEEDOR"]]'),
  ('OC_Lineas', '[["OC_ID","ITEM","DESCRIPCION","CANTIDAD","PRECIO_UNITARIO","TOTAL","PARTIDA_ID","PEDIDO","PEDIDO_PARTIDA","PART_NUMBER","RECIBIDO","RECEPCIONES"]]'),
  ('Proveedores', '[["Nombre","Identificación","Dirección","Ciudad","Estado","CP","Teléfono","Email","Contacto","Notas"]]'),
  ('12 Inventario Rep.', '[[],[],[],[],["SKU","Descripción","OEM","Serie","Unidad","Stock","Mínimo","Precio","Ubicación","Notas","Equipo","","","Proveedor"]]'),
  ('Movimientos Repuestos PA', '[["ID","FECHA_UTC","TIPO","SKU","CANTIDAD","UNIDAD","OC","PARTIDA","OT","REFERENCIA","ACTOR","ACTOR_ID","EXISTENCIA","MEDIDA"]]'),
  ('02 Gastos', '[["ID","FECHA","HORA","TIPO","PROVEEDOR","IDENTIFICACION","FOLIO_FACTURA","SUBTOTAL","ITBMS","TOTAL","UNIDAD","OT","RESPONSABLE","METODO_PAGO","LINE_ITEMS","IMAGEN_URL","ESTADO","FOLIO_GASTO","ACTOR_ID","TOTAL_DOCUMENTO","OPERACION","ENTIDAD","MONEDA","IMPUESTO","FECHA_DOCUMENTO","REVISOR_ID","FECHA_REVISION","MOTIVO_REVISION","FECHA_UTC"]]'),
  ('10 Control Cambios', '[["OPERACION","TIMESTAMP","ACTOR","MODULO","ACCION","DETALLE","FOLIO","ROL_ACTOR_ID"]]'),
  ('Activos', '[["UNIDAD","MODELO","MARCA","AÑO","FECHA_ADQUISICION","COSTO_ADQUISICION","VIDA_UTIL_ANOS","VALOR_RESIDUAL","METODO","HORAS_TOTALES_VIDA","SEGMENTO","NOTAS"]]')
on conflict (name) do update
  set rows = jsonb_set(hermes_panama_operational_tables.rows, '{0}', excluded.rows->0);

create or replace function public.hermes_panama_commit(
  operation_key text, operation_fingerprint text, guards text[], changes jsonb, outcome jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  prior public.hermes_panama_commit_receipts%rowtype;
  change jsonb;
  tab_name text;
  tab_rows jsonb;
  row_index integer;
  column_index integer;
  cell jsonb;
  new_row jsonb;
  row_cell jsonb;
  entry jsonb;
  required_cells integer;
begin
  if operation_key is null or char_length(operation_key) not between 1 and 300
    or operation_fingerprint is null or char_length(operation_fingerprint) not between 1 and 256
    or guards is null or cardinality(guards) > 220
    or exists (select 1 from unnest(guards) as g(value) where value is null or char_length(value) not between 1 and 300)
    or jsonb_typeof(changes) is distinct from 'array' or outcome is null or outcome = 'null'::jsonb
  then
    raise sqlstate 'PT400' using message = 'La operación no contiene cambios válidos.';
  end if;
  if jsonb_array_length(changes) not between 1 and 325 then
    raise sqlstate 'PT400' using message = 'La operación no contiene cambios válidos.';
  end if;

  -- All operations share this lock so version checks, appends and receipts commit together.
  perform pg_catalog.pg_advisory_xact_lock(863019441);
  select r.* into prior from public.hermes_panama_commit_receipts as r where r.operation_key = $1;
  if found then
    if prior.fingerprint <> operation_fingerprint then
      raise sqlstate 'PT409' using message = 'La operación ya existe con otros datos.';
    end if;
    return jsonb_build_object('result', prior.result, 'replayed', true);
  end if;
  if exists (select 1 from public.hermes_panama_write_guards as g where g.guard = any(guards)) then
    raise sqlstate 'PT409' using message = 'El registro cambió en otra sesión. Actualiza antes de continuar.';
  end if;

  for tab_name in select distinct item.value->>'tab' from jsonb_array_elements(changes) as item(value) loop
    select t.rows into tab_rows from public.hermes_panama_operational_tables as t where t.name = tab_name;
    if not found then
      raise sqlstate 'PT400' using message = 'El destino de la operación no está habilitado.';
    end if;
    for change in
      select item.value from jsonb_array_elements(changes) with ordinality as item(value, position)
      where item.value->>'tab' = tab_name order by item.position
    loop
      if change ? 'append' then
        if jsonb_typeof(change->'append') is distinct from 'array' or change ? 'row' or change ? 'values' or change ? 'col' then
          raise sqlstate 'PT400' using message = 'Revisa las filas de la operación.';
        end if;
        entry := change->'append';
      else
        if coalesce(change->>'row','') !~ '^[1-9][0-9]{0,8}$'
          or coalesce(change->>'col','0') !~ '^[0-9]{1,3}$' then
          raise sqlstate 'PT400' using message = 'Revisa la posición del registro.';
        end if;
        row_index := (change->>'row')::integer;
        column_index := coalesce((change->>'col')::integer, 0);
        if row_index >= jsonb_array_length(tab_rows) then
          raise sqlstate 'PT409' using message = 'El registro cambió. Actualiza antes de continuar.';
        end if;
        entry := jsonb_build_array(change->'values');
      end if;
      if jsonb_array_length(entry) not between 1 and 300 then
        raise sqlstate 'PT400' using message = 'Revisa las filas de la operación.';
      end if;
      for row_cell in select value from jsonb_array_elements(entry) with ordinality as item(value, position) order by position loop
        if jsonb_typeof(row_cell) is distinct from 'array' then
          raise sqlstate 'PT400' using message = 'Revisa las celdas de la operación.';
        end if;
        if jsonb_array_length(row_cell) > 256 then
          raise sqlstate 'PT400' using message = 'Revisa las celdas de la operación.';
        end if;
        new_row := '[]'::jsonb;
        for cell in select value from jsonb_array_elements(row_cell) with ordinality as item(value, position) order by position loop
          if jsonb_typeof(cell) not in ('string','number','boolean','null') or char_length(cell #>> '{}') > 50000 then
            raise sqlstate 'PT400' using message = 'Una celda contiene datos inválidos.';
          end if;
          new_row := new_row || jsonb_build_array(coalesce(cell #>> '{}', ''));
        end loop;
        if change ? 'append' then
          tab_rows := tab_rows || jsonb_build_array(new_row);
        else
          row_cell := tab_rows->row_index;
          required_cells := column_index + jsonb_array_length(new_row);
          if required_cells > 256 then
            raise sqlstate 'PT400' using message = 'Revisa la posición del registro.';
          end if;
          while jsonb_array_length(row_cell) < required_cells loop
            row_cell := row_cell || '[""]'::jsonb;
          end loop;
          for i in 0 .. jsonb_array_length(new_row) - 1 loop
            row_cell := jsonb_set(row_cell, array[(column_index + i)::text], new_row->i, false);
          end loop;
          tab_rows := jsonb_set(tab_rows, array[row_index::text], row_cell, false);
        end if;
      end loop;
    end loop;
    update public.hermes_panama_operational_tables as t set rows = tab_rows where t.name = tab_name;
  end loop;

  insert into public.hermes_panama_commit_receipts (operation_key, fingerprint, result) values ($1, $2, outcome);
  insert into public.hermes_panama_write_guards (guard, operation_key) select distinct value, $1 from unnest(guards) as g(value);
  return jsonb_build_object('result', outcome, 'replayed', false);
end;
$$;

revoke all on function public.hermes_panama_commit(text,text,text[],jsonb,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.hermes_panama_commit(text,text,text[],jsonb,jsonb) to service_role;

notify pgrst, 'reload schema';

commit;
