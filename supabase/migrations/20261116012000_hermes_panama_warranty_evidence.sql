alter table public.hermes_panama_evidence
  drop constraint hermes_panama_evidence_kind_check,
  drop constraint hermes_panama_evidence_check2,
  drop constraint hermes_panama_evidence_check3,
  add constraint hermes_panama_evidence_kind_check
    check (kind in ('report', 'dvir', 'sticker', 'order', 'receipt', 'warranty')),
  add constraint hermes_panama_evidence_record_id_check
    check ((kind in ('order', 'warranty') and record_id ~* '^OT-[a-z0-9][a-z0-9_-]{0,86}$')
      or (kind not in ('order', 'warranty') and record_id = '')),
  add constraint hermes_panama_evidence_mime_type_check
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')
      or (kind in ('receipt', 'warranty') and mime_type = 'application/pdf')),
  add constraint hermes_panama_evidence_warranty_slots_check
    check (kind <> 'warranty' or slot <= 3);

insert into public.hermes_panama_operational_tables (name, rows)
values ('HERMES_PA_GARANTIAS', '[["TIMESTAMP","OT_ID","CAMPO","CASO","EVENTO","ACTOR","ROL","ACTOR_ID"]]')
on conflict (name) do nothing;
