-- Keep PM delivery records in the existing private operational store.
insert into public.hermes_panama_operational_tables (name, rows)
values ('HERMES_PA_ENTREGA_ALERTAS',
  '[["FOLIO","ETAPA","FECHA_UTC","INTENTO","REFERENCIA","DETALLE_JSON"]]'::jsonb)
on conflict (name) do nothing;
