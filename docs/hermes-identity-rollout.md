# Acceso del equipo a Hermes

Hermes autentica con la cuenta individual del proveedor Supabase y consulta el padrón de Hermes para determinar rol, proyecto y unidades. Las membresías de CMMS se administran por separado. La app usa una cookie privada y verifica que la sesión y la asignación sigan activas en cada solicitud protegida.

## Preparación del entorno

1. Aplica `supabase/migrations/20261112030000_hermes_identity.sql` en el proyecto de identidad del entorno autorizado.
2. Configura `HERMES_AUTH_SECRET`, `HERMES_AUTH_SUPABASE_URL`, `HERMES_AUTH_SUPABASE_PUBLISHABLE_KEY`, `HERMES_AUTH_SUPABASE_SERVICE_ROLE_KEY` y `HERMES_AUTH_PROJECT` en el servidor. El código de proyecto debe coincidir con el padrón y las fuentes operativas de ese despliegue. La clave de servicio y el padrón permanecen en el servidor.
3. Vincula el padrón aprobado a los correos confirmados en el proveedor. Conserva el archivo con datos reales fuera del repositorio.

En Panamá, aplica también las migraciones de permiso de recepción y revisión HSE.
Las opciones `canReceivePurchases` y `canReviewPanamaHse` deben constar explícitamente
en el padrón y son independientes de `canApprovePurchases`. Usa `projects: ["tmf-panama"]`
para esos permisos. La revisión HSE requiere rol base Supervisor o Gerencia.

Formato de una fila de prueba

```json
[
  {
    "email": "employee@example.test",
    "userName": "Empleado de prueba",
    "role": "operador",
    "projects": ["tcm"],
    "unitScope": "assigned",
    "assignedUnits": ["CA20"]
  }
]
```

Usa `unitScope: "all"` para acceso explícito a las unidades del proyecto. `canApprovePurchases: true` requiere una autorización de compras ya aprobada y un rol de Gerencia. `active: false` revoca el acceso del usuario al siguiente intento de consultar una ruta protegida.

```sh
node scripts/import-hermes-roster.mjs /ruta/padron-aprobado.json
node scripts/import-hermes-roster.mjs /ruta/padron-aprobado.json --apply
```

La validación informa filas elegibles y pendientes sin imprimir correos ni nombres. La carga actualiza la asignación por identidad verificada y conserva el registro de primer ingreso. Para una fila sin cuenta confirmada, el administrador de identidad completa el alta en el proveedor y vuelve a ejecutar la carga del padrón.

## Conteos del arranque

Consulta las cuentas activas y los primeros ingresos del proyecto. Usa la bitácora operativa con el ID de usuario para contar primeras tareas completadas.

```sql
select
  count(*) filter (where active) as habilitadas,
  count(*) filter (where active and first_login_at is not null) as primeros_ingresos
from public.hermes_memberships
where 'tcm' = any(projects);
```

Para el tercer conteo, identifica un registro confirmado por persona desde la hora de inicio del turno. Usa el ID del actor en `OT_STATUS_LOG`, `Hermes_Transacciones` o `10 Control Cambios`, según la tarea. Cuenta a cada cuenta habilitada una vez. Si una persona todavía no tiene una tarea real asignada, déjala como pendiente.

| Rol | Primera tarea |
| --- | --- |
| Operador | Completar el DVIR de su unidad o reportar una falla real y conservar el folio. |
| Mecánico | Registrar el avance de su primera OT asignada. |
| Jefe de Taller | Asignar una OT pendiente al mecánico autorizado para la unidad. |
| Coordinador | Programar una OT PM real en Calendario o asignar una OT pendiente. |
| Supervisor | Resolver un Sticker pendiente conforme al procedimiento de liberación de equipos. |
| Gerencia | Registrar el borrador de un pedido real en Órdenes de Compra. La aprobación queda a cargo de la cuenta autorizada. |

## Publicación y continuidad del turno

1. Ejecuta `npm test`, `npm run test:api` y `node scripts/qa-rollout/run.mjs` sobre el mismo árbol de código. En preproducción usa credenciales y fuentes aisladas y destinos de prueba autorizados. Verifica qué variantes de fotos, recibos, OCR y avisos están disponibles en el entorno.
2. Antes de promover en Vercel, comprueba que los ingresos reales se correspondan con el padrón y que las rutas apliquen sus permisos. Configura `HERMES_GOOGLE_SHEET_ID` y `HERMES_GOOGLE_SERVICE_ACCOUNT_JSON` para la fuente correcta. Confirma los emisores en `HERMES_PURCHASE_ISSUERS_JSON`. Habilita adjuntos de Gastos cuando el servicio privado esté operativo.
3. Registra el commit, ID del despliegue y hora de inicio. Guarda los conteos de cuentas activas, primeros ingresos y primeras tareas. Si hay una captura pendiente, registra módulo, folio, unidad, hora y etapa en el canal del turno. El usuario debe conservar el folio al reintentar.
4. Para detener una escritura específica agrega su ruta del gateway a `HERMES_PAUSED_OPERATIONS`. Para detener el conjunto de escrituras del gateway activa `HERMES_READ_ONLY=true` y vuelve a desplegar la versión con identidad individual. Conserva las hojas y las bitácoras. Usa el procedimiento vigente del área durante la pausa. Una versión anterior solo sirve de destino de reversión si valida la misma identidad y comprende los registros ya generados.
5. Comprueba las operaciones corregidas con cuentas aisladas antes de reactivarlas. Reconcilia los folios pendientes contra la fuente y conserva los registros confirmados durante el turno.
