begin;

alter table public.hermes_memberships
  drop constraint hermes_memberships_role_check,
  add constraint hermes_memberships_role_check check (
    role in ('operador', 'mecanico', 'jefe_taller', 'coordinador', 'supervisor', 'gerencia', 'almacen')
    and (role <> 'almacen' or (projects = array['tmf-panama']::text[] and can_receive_purchases))
  );

commit;
