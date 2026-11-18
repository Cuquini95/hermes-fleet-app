# Hermes Panamá

Rama de la aplicación independiente para TMF Minera Panamá. La navegación de Hermes sigue disponible por rol. En Más → Maestros TMF se consultan fuentes panameñas por unidad. Los estados provisionales, los controles de integridad y los costos no disponibles se conservan como aparecen en el maestro.

## Configuración del proyecto independiente

| Configuración | Fuente o propósito |
| --- | --- |
| HERMES_AUTH_PROJECT | `tmf-panama` |
| HERMES_AUTH_SUPABASE_URL, HERMES_AUTH_SUPABASE_PUBLISHABLE_KEY, HERMES_AUTH_SUPABASE_SERVICE_ROLE_KEY | Proyecto de identidad dedicado a Hermes Panamá. Usa la migración de membresías y sesiones y revisa la matriz de permisos. |
| HERMES_AUTH_SECRET | Secreto propio de sesión, mínimo 32 caracteres aleatorios. |
| HERMES_PANAMA_GOOGLE_SERVICE_ACCOUNT_JSON | Cuenta de servicio dedicada con permiso de lector sobre los maestros. |
| HERMES_PANAMA_TMF_SHEET_ID | Disponibilidad TMF Maestro. Pestañas EQUIPOS y REGISTRO. |
| HERMES_PANAMA_WORKSHOP_SHEET_ID | Taller - Órdenes de Trabajo. Pestañas FALLAS TMF y OTS. |
| HERMES_PANAMA_PM_SHEET_ID | Flota - Master Control PM. Pestaña PM FLOTA. |
| HERMES_PANAMA_DOZERS_SHEET_ID, HERMES_PANAMA_EXCAVATORS_SHEET_ID | Maestros de Componentes. Pestaña RESUMEN JEFE en cada archivo. |
| HERMES_PANAMA_PURCHASES_SHEET_ID | Cotizaciones - Trans Plus. Consulta de Pa - Maquinaria, con filtro obligatorio de país Panamá. |
| HERMES_PANAMA_COSTS_SHEET_ID | Control de Costos por Máquina. RESUMEN por unidad, visible para Gerencia. |
| Registro operativo | Las migraciones de operaciones y evidencias crean el registro PostgreSQL y el bucket privado en el Supabase de Panamá. Vercel usa las credenciales de servidor del proyecto. |
| HERMES_PURCHASE_ISSUERS_JSON | Opcional. El emisor predeterminado es TRANSPLUS, S.A. en USD. Cada captura usa el ITBMS del documento. |
| HERMES_READ_ONLY | `true` pausa todas las escrituras en producción. |
| HERMES_PANAMA_WRITE_GROUPS | Selecciona los flujos habilitados. Por defecto quedan disponibles los flujos internos; una lista vacía activa consulta. El grupo despacho requiere además `HERMES_PANAMA_DISPATCH_VERIFIED=true`. |
| HERMES_PANAMA_FUEL_CAPTURE | `false` deshabilita la captura de combustible. Los despachos capturados quedan en el registro de Hermes. |
| HERMES_PANAMA_INVENTORY_VALUATIONS_JSON | Valuación aprobada por Finanzas para salidas de Almacén. Cada SKU admite una sola entrada con `partNumber`, `unitCost`, `currency` (USD o PAB) y `reference` del soporte aprobado. La salida conserva ese costo y la devolución revierte la porción correspondiente al mismo costo. Si falta el soporte, la existencia se actualiza y el costo queda pendiente. El precio del catálogo y el de la última OC no sustituyen la valuación aprobada. |
| HERMES_PANAMA_PM_CHECKLISTS_JSON | Catálogo aprobado por Taller. Cada entrada contiene `model`, `level`, `reference`, `tasks` y, cuando aplique, `serial` con el PIN o serie exactos del Maestro de Equipos. Cada tarea contiene `id`, `label` y opcionalmente `evidence: "photo"`. La OT conserva la revisión elegida al programarla y la entrega exige las fotos indicadas. |
| HERMES_PANAMA_PM_TRIGGER_RULES_JSON | Reglas aprobadas de fecha y condición por `unit` y `level`. Cada entrada exige `reference` con la revisión del plan. `dueDate` usa AAAA-MM-DD, y `condition` admite `source` (`dozers` o `excavators`) y `minCritical` (entero positivo). Fecha y condición se consumen al completar la OT. Registra la nueva fecha o revisión aprobada para habilitar el siguiente ciclo. Las horas se leen del plan aprobado de PM FLOTA. Taller confirma la creación de la orden. |
| VITE_HERMES_PA_PM_MASTER_LINK, VITE_HERMES_PA_PM_REGISTER_LINK, VITE_HERMES_PA_VALUATION_LINK, VITE_HERMES_PA_FINANCE_LINK | Enlaces opcionales a maestros compartidos con el equipo. Los enlaces solo sirven para abrir Drive y conservan sus permisos. Cualquier URL del frontend es visible en el paquete compilado. |

Usa los 28 puestos del organigrama R06 y una identidad individual por persona. Varias personas pueden ocupar el mismo puesto. Los correos, suplencias y alcances requieren el padrón F01 vigente y su aprobación. `scripts/import-hermes-roster.mjs` valida y vincula cuentas existentes. El importador no crea credenciales. Mantén pendientes las asignaciones locales que el responsable TMF todavía deba confirmar. Usa el proyecto de identidad exclusivo de Panamá.

## Habilitar el turno

1. Aplica las migraciones de identidad y los permisos de recepción y HSE en Supabase Panamá. Conecta el proyecto Vercel `hermes-panama` al proveedor mediante sus variables de servidor y vuelve a desplegar. Valida una sesión con el correo de trabajo y revisa el conteo de primeros ingresos.
2. Aplica las migraciones del registro y de adjuntos privados. Conecta los maestros para consulta. Los relevos aceptados muestran el cotejo de lecturas con REGISTRO cuando la cuenta lectora tiene acceso al maestro.
3. Para Almacén activa `canReceivePurchases` solo en el padrón autorizado, con las unidades asignadas. El permiso habilita el registro por partida y su historial. Compras y Finanzas consultan el saldo en la OC.
4. La revisión HSE de stickers requiere `canReviewPanamaHse` para el responsable autorizado. El ejecutor entrega la OT con prueba funcional. Taller confirma el cierre y Operaciones acepta el retorno por separado. Un bloqueo vigente de HSE impide aceptar el retorno.
5. Comprueba el acceso al dominio con una cuenta corporativa sin acceso administrativo a Vercel. Si la protección del alojamiento exige sesión de Vercel, el administrador ajusta el alcance del dominio cuando la autenticación y las rutas privadas de Hermes estén verificadas.
6. Verifica los recorridos en un entorno aislado con `node scripts/qa-rollout/run.mjs` y conserva la evidencia del primer turno de cada persona. Usa los procedimientos vigentes de cada área para conciliación y continuidad durante el arranque.

## Alcance de las pruebas

La suite de Hermes conserva el modelo transaccional original en un almacén de prueba. Prueba reportes con reintento, asignación por identidad, avance, cierre, PM y calendario, pedido, OC, aprobación y recepciones parciales. Los valores del emisor de prueba son ficticios.

Las nuevas averías, OT, inspecciones, compras y gastos quedan en Hermes. Los maestros oficiales se consultan por separado y pueden mostrar un corte fechado. La conciliación con Sheets se verifica por folio. Almacén distingue la recepción documental del movimiento de un SKU dado de alta.

Verifica los procedimientos y fuentes de llantas, inventario, compras, costos, combustible, avisos y documentos oficiales de acceso antes de su activación. Las rutas de integración del Hermes anterior y el enlace CMMS quedan fuera del candidato de Panamá hasta tener endpoints propios.

### Recuperación de acceso y diagnóstico de fuentes

El acceso muestra «Recuperar contraseña». Para habilitar el envío, TI configura el proveedor Supabase de Panamá y su plantilla de recuperación para incluir el código de un solo uso `{{ .Token }}`. Comprobar entrega y caducidad con un buzón de prueba autorizado antes de activar `HERMES_RECOVERY_ENABLED=true`. El formulario recibe el código y solicita una contraseña nueva. La API confirma la membresía activa de Panamá y el código con Supabase y revoca las sesiones Hermes de esa cuenta. Usar el control de frecuencia de infraestructura del proyecto además del límite por instancia.

La salud del gateway comprueba sesión, maestro de flota y registro operativo. Una prueba de guardado y relectura comprueba por separado la escritura.

El inventario y la comprobación de flota en Producción y Preview operativo leen primero el corte privado de flota. Si el corte falla, consultan el maestro en Sheets. El panel muestra la fecha y hora del corte cuando recibe datos de ese respaldo.

La sección de Manuales y Diagramas en Panamá usa `HERMES_PANAMA_TECHNICAL_CATALOG_JSON`. Cada entrada contiene `title`, `model`, `kind` (manual o diagram), `source` y `url` de archivo de Google Drive. Taller debe verificar edición, aplicación por equipo y permiso de lectura en Drive antes de publicar una entrada. El vínculo conserva los permisos existentes de Drive. El entorno sin catálogo indica biblioteca no disponible.

La flota puede complementar marca, modelo y serie mediante `HERMES_PANAMA_EQUIPMENT_SHEET_ID`, con lectura de `EQUIPOS!A3:M` del Maestro de Equipos. Solo se unen filas de Panamá y TMF por código inequívoco. Los campos sin fuente, como horómetro actual y disponibilidad de despacho, requieren sus registros propios.

El PDF de Programa PM y de la orden usa el enlace de equipo en AJUSTES y el
corte `pmChecklists` de Flota - Checklists PM, en
`hermes_panama_source_snapshots`. El campo `rows` contiene las pestañas técnicas
con el formato `[{ id, name, rows }]`, desde la cabecera hasta Hallazgos y firmas.
El PDF incluye los intervalos correspondientes y conserva las condiciones por
modelo. Actualiza ese corte cuando se revisen las tareas del maestro.
