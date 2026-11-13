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
| HERMES_PANAMA_OPERATIONS_SHEET_ID, HERMES_PANAMA_OPERATIONS_SERVICE_ACCOUNT_JSON | Libro operativo separado de los maestros. Su pestaña HERMES_PA_CONFIG debe contener HERMES_PANAMA y tmf-panama en A1:B1. El servicio rechaza los IDs de los maestros configurados. Usa un libro aislado para la verificación y conserva los folios en el libro de cada entorno. |
| HERMES_PURCHASE_ISSUERS_JSON | Emisor panameño validado, con identificación fiscal, moneda y regla fiscal. Solo se admiten emisores con plantilla Trans Plus y USD o PAB para el proyecto Panamá. |
| VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, HERMES_WORKSHOP_STORAGE_ORIGIN | Almacenamiento dedicado para evidencias, una vez verificados los permisos. |
| HERMES_READ_ONLY | `true` para el candidato de consulta. |
| HERMES_PANAMA_WRITES_ENABLED | Mantener sin habilitar hasta verificar en un entorno aislado la integración de escrituras con los maestros. |
| HERMES_PANAMA_PM_CHECKLISTS_JSON | Catálogo validado de checklists por modelo y nivel, con referencia, identificadores y etiquetas de cada tarea. Taller comprueba el checklist al entregar y aceptar el PM. |
| VITE_HERMES_PA_PM_MASTER_LINK, VITE_HERMES_PA_PM_REGISTER_LINK, VITE_HERMES_PA_VALUATION_LINK, VITE_HERMES_PA_FINANCE_LINK | Enlaces opcionales a maestros compartidos con el equipo. Los enlaces solo sirven para abrir Drive y conservan sus permisos. Cualquier URL del frontend es visible en el paquete compilado. |

Usa el padrón de 28 personas, los correos confirmados en la identidad propia y los alcances aprobados para cada puesto. `scripts/import-hermes-roster.mjs` valida y vincula cuentas existentes. El importador no crea credenciales. Mantén pendientes las asignaciones locales que el responsable TMF todavía deba confirmar. Usa el proyecto de identidad exclusivo de Panamá.

## Habilitar el turno

1. Aplica las migraciones de identidad y los permisos de recepción y HSE en Supabase Panamá. Conecta el proyecto Vercel `hermes-panama` al proveedor mediante sus variables de servidor y vuelve a desplegar. Valida una sesión con el correo de trabajo y revisa el conteo de primeros ingresos.
2. Configura el acceso de solo lectura a los maestros y el acceso de edición al libro operativo aislado. Verifica la correspondencia por folio antes de habilitar escrituras productivas. Los folios aceptados de relevo siguen pendientes de conciliación en REGISTRO de Disponibilidad TMF.
3. Para Almacén activa `canReceivePurchases` solo en el padrón autorizado, con las unidades asignadas. El permiso habilita el registro por partida y su historial. Compras y Finanzas consultan el saldo en la OC.
4. La revisión HSE de stickers requiere `canReviewPanamaHse` para el responsable autorizado. El ejecutor entrega la OT con prueba funcional. Taller confirma el cierre y Operaciones acepta el retorno por separado. Un bloqueo vigente de HSE impide aceptar el retorno.
5. Comprueba el acceso al dominio con una cuenta corporativa sin acceso administrativo a Vercel. Si la protección del alojamiento exige sesión de Vercel, el administrador ajusta el alcance del dominio cuando la autenticación y las rutas privadas de Hermes estén verificadas.
6. Verifica los recorridos en un entorno aislado con `node scripts/qa-rollout/run.mjs` y conserva la evidencia del primer turno de cada persona. Usa los procedimientos vigentes de cada área para conciliación y continuidad durante el arranque.

## Alcance de las pruebas

La suite de Hermes conserva el modelo transaccional original en un almacén de prueba. Prueba reportes con reintento, asignación por identidad, avance, cierre, PM y calendario, pedido, OC, aprobación y recepciones parciales. Los valores del emisor de prueba son ficticios.

Para uso productivo, vincula las nuevas operaciones a los campos de captura de los maestros oficiales. Taller calcula parte del estado en OTS. PM separa captura, fórmulas, evidencia y aceptación en ANOTAR PM. PARTIDAS_RECEPCION acumula el recibido y las devoluciones por partida y necesita el enlace comprobado a una cabecera panameña. Las escrituras sobre esos maestros requieren adaptadores y una prueba aislada de conciliación antes de habilitarlas. Una OT de prueba en el modelo de Hermes no acredita cierre en OTS. Conserva la operación vigente durante el corte.

Verifica los procedimientos y fuentes de llantas, inventario, compras, costos, combustible, avisos y documentos oficiales de acceso antes de su activación. Las rutas de integración del Hermes anterior y el enlace CMMS quedan fuera del candidato de Panamá hasta tener endpoints propios.

### Recuperación de acceso y diagnóstico de fuentes

El acceso muestra «Recuperar contraseña». Para habilitar el envío, TI configura el proveedor Supabase de Panamá y su plantilla de recuperación para incluir el código de un solo uso `{{ .Token }}`. Comprobar entrega y caducidad con un buzón de prueba autorizado antes de activar `HERMES_RECOVERY_ENABLED=true`. El formulario recibe el código y solicita una contraseña nueva. La API confirma la membresía activa de Panamá y el código con Supabase y revoca las sesiones Hermes de esa cuenta. Usar el control de frecuencia de infraestructura del proyecto además del límite por instancia.

La salud autenticada del gateway distingue sesión, maestro de flota y libro operativo. La lectura del maestro no basta para mostrar el libro como disponible. Una fuente caída se informa como degradación. El resultado de una lectura del libro no certifica sus permisos de escritura.

La sección de Manuales y Diagramas en Panamá usa `HERMES_PANAMA_TECHNICAL_CATALOG_JSON`. Cada entrada contiene `title`, `model`, `kind` (manual o diagram), `source` y `url` de archivo de Google Drive. Taller debe verificar edición, aplicación por equipo y permiso de lectura en Drive antes de publicar una entrada. El vínculo conserva los permisos existentes de Drive. El entorno sin catálogo indica biblioteca no disponible.

La flota puede complementar marca, modelo y serie mediante `HERMES_PANAMA_EQUIPMENT_SHEET_ID`, con lectura de `EQUIPOS!A3:M` del Maestro de Equipos. Solo se unen filas de Panamá y TMF por código inequívoco. Los campos sin fuente, como horómetro actual y disponibilidad de despacho, requieren sus registros propios.
