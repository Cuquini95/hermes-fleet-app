-- Independent append-only application ledger. The closed expense row is never replaced.
insert into public.hermes_panama_operational_tables (name, rows)
values ('HERMES_PA_AJUSTES_GASTOS',
  '[["GASTO_ID","AJUSTE_ID","EVENTO","DETALLE_JSON"]]'::jsonb)
on conflict (name) do nothing;
