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
| HERMES_PANAMA_OPERATIONS_SHEET_ID, HERMES_PANAMA_OPERATIONS_SERVICE_ACCOUNT_JSON | Libro separado del modelo de Hermes, para pruebas transaccionales. Su pestaña HERMES_PA_CONFIG debe contener HERMES_PANAMA y tmf-panama en A1:B1. Rechaza los IDs de los maestros configurados. |
| HERMES_PURCHASE_ISSUERS_JSON | Emisor panameño validado, con identificación fiscal, moneda y regla fiscal. Solo se admiten emisores con plantilla Trans Plus y USD o PAB para el proyecto Panamá. |
| VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, HERMES_WORKSHOP_STORAGE_ORIGIN | Almacenamiento dedicado para evidencias, una vez verificados los permisos. |
| HERMES_READ_ONLY | `true` para el candidato de consulta. |
| HERMES_PANAMA_WRITES_ENABLED | Mantener sin habilitar hasta verificar en un entorno aislado la integración de escrituras con los maestros. |

Usa el padrón de 28 personas, los correos confirmados en la identidad propia y los alcances aprobados para cada puesto. `scripts/import-hermes-roster.mjs` valida y vincula cuentas existentes. El importador no crea credenciales. No cargues las asignaciones locales de TMF marcadas como pendientes. La base de México no se usa como proveedor.

## Alcance de las pruebas

La suite de Hermes conserva el modelo transaccional original en un almacén de prueba. Prueba reportes con reintento, asignación por identidad, avance, cierre, PM y calendario, pedido, OC, aprobación y recepciones parciales. Los valores del emisor de prueba son ficticios.

Para uso productivo, vincula las nuevas operaciones a los campos de captura de los maestros oficiales. Taller calcula parte del estado en OTS. PM separa captura, fórmulas, evidencia y aceptación en ANOTAR PM. PARTIDAS_RECEPCION acumula el recibido y las devoluciones por partida y necesita el enlace comprobado a una cabecera panameña. Las escrituras sobre esos maestros requieren adaptadores y una prueba aislada de conciliación antes de habilitarlas. Una OT de prueba en el modelo de Hermes no acredita cierre en OTS. Conserva la operación vigente durante el corte.

Verifica los procedimientos y fuentes de llantas, inventario, compras, costos, combustible, avisos y documentos oficiales de acceso antes de su activación. Las rutas de integración del Hermes anterior y el enlace CMMS quedan fuera del candidato de Panamá hasta tener endpoints propios.
