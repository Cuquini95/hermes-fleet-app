-- Use the existing private operational store and its atomic receipt/guard path.
-- Keep odometer values outside the hours-only ledger used by PM and REGISTRO.
insert into public.hermes_panama_operational_tables (name, rows)
values ('HERMES_PA_ODOMETRO',
  '[["UNIDAD","MEDIDO_EN","KILOMETROS","REFERENCIA","REGISTRADO_EN","AUTOR_ID"]]'::jsonb)
on conflict (name) do nothing;
