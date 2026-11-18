# Hermes Panamá — entrega de mejoras

Fecha de referencia: 17 de noviembre de 2026, Panamá. El registro de pruebas conserva horas UTC.

## Versión y alcance

Base confirmada: `d3f9091cf2517ca0ba33530a105777579bda6872`, producción Vercel
`dpl_8qQy8H6gsL57YnCVZSYmUUyjHdJF`, proyecto `hermes-panama`.
Repositorio compartido: `Cuquini95/hermes-fleet-app`; candidata en
`codex/hermes-panama-implementation-20261117`. Las otras aplicaciones conservan
sus ramas, datos y despliegues.

Base de Panamá: Supabase `obbprafandihkweebwtr`, PostgreSQL 17.11, región us-east-1.
El registro operativo, sesiones y evidencias privadas ya existían. Esta entrega
no añade migraciones de producción ni modifica cuentas, inventario, aprobaciones
o archivos reales. No se cambian las automatizaciones ni sus destinatarios.

## Cambios y alcance de la comprobación

| Frente | Antes | Entrega |
| --- | --- | --- |
| A. Teléfono | Encabezado cargado; panel de estado podía salir del teléfono. | Encabezado compacto, menú de cuenta, navegación de cinco destinos, controles de 44 px, panel dentro del viewport, altura adaptada al teclado y serie visible en la ficha del equipo. |
| B. PM | Serie manual en el PDF; saldo del maestro podía contradecir horas y vencimiento. | Serie del maestro por código y modelo inequívocos, revisión del catálogo, aviso de borrador, rechazo de conflictos y saldo calculado con bloqueo de conciliación. Se conserva el ciclo configurado. |
| C. Personas | Ya había identidad individual y catálogo de los 28 puestos. La documentación confundía puestos con personas. | Se corrige esa confusión. Se preservan permisos y bandejas personales, incluidos Almacén, facturas y pagos. El mapa propuesto abajo requiere F01 y matriz de autoridad vigentes. |
| D. OT–Almacén–Compras | Ya existía el circuito transaccional con reservas, recepciones y aceptación separada. | Se verifica el circuito y la continuidad de sus vínculos con pruebas aisladas; los movimientos reales y el conteo inicial no se fabrican. |
| E. Historial | Historial disponible en pantalla; faltaba exportación integral de OT. | PDF de OT con identidad, cambios antes/después, responsables, repuestos, costos por moneda y aprobaciones según registro. La falta de costos se identifica; no se convierte en cero. |
| F. Indicadores | El briefing podía comparar litros absolutos entre equipos. | Comparación de Σ litros / Σ horas conciliadas, por día/7/15 días de Panamá, por familia; articulados separados. Se muestran cobertura e intervalos excluidos. No se fijan bonos ni umbrales nuevos. |
| G. Guardado | Cola y comprobantes de operación ya existían. | Se amplía la aceptación de reinicio sin señal y reconexión a tres repeticiones, conservando bytes y verificando un solo registro. |
| H. Recuperación | El arnés local no inicializaba todos los prerrequisitos de la versión actual. | Se corrige el entorno aislado de recuperación y se verifica reversión al código de producción anterior. La recuperación administrada continúa pendiente de un destino separado. |

Los PDF conservan referencias a las evidencias originales. Consultar las imágenes
originales requiere la sesión y el permiso correspondientes; no se publican enlaces
que evadan el acceso privado. Un campo de firma vacío no representa una aprobación.

## Fuentes y propiedad de los datos

Los nombres siguientes corresponden a las claves del servidor y a su configuración;
no incluyen credenciales. El panel de estado y Maestros TMF muestran los cortes recibidos.

| Datos / identificador | Fuente autorizada y dirección | Conflictos / responsable propuesto |
| --- | --- | --- |
| Flota / código | EQUIPOS de Disponibilidad TMF → corte `fleet` → consulta Hermes. | Código duplicado bloquea unión; Operaciones valida altas. |
| Identidad de equipo / código + modelo + serie | Maestro de Equipos de Panamá/TMF → `equipmentDetails` → Hermes. | Modelo o serie de OT distintos bloquean PDF aplicable; Taller y Operaciones revisan. |
| Turnos oficiales / clave + código + fecha + turno | REGISTRO → corte `shifts` → conciliación del parte Hermes. | El corte no sustituye un parte aceptado ni su corrección; supervisor revisa diferencias. |
| Fallas y OT históricas / caso, OT y equipo | FALLAS TMF y OTS → cortes `failures`, `orders` → consulta y conciliación. | Se conserva la procedencia; una importación no borra la OT nativa ni su historial. |
| PM / código, nivel, revisión | PM FLOTA, AJUSTES, CALC y catálogo técnico → `maintenance`, `maintenancePlan`, `maintenanceAnchor`, `pmChecklists`. | Taller aprueba aplicabilidad, tareas y política; un cierre nativo pendiente de conciliación bloquea la siguiente programación. |
| Componentes / equipo + posición | Maestros de Dozers y Excavadoras → cortes `dozers`, `excavators` y sus historiales. | Intervenciones y lecturas regresivas quedan por conciliar; Taller valida. |
| Compras históricas / folio + equipo + país | Pa - Maquinaria → `purchases` → consulta. | Filtro Panamá obligatorio. El corte no confirma recepción de una OC nativa. |
| Costos del maestro / unidad + período + moneda | RESUMEN por máquina → `costs` → consulta Gerencia. | Se identifica como costo parcial; Finanzas concilia contra consumo, mano de obra y servicios. |
| Valorización y cobro / vínculo de documento y período | VALORIZACION y DOCUMENTOS COBRO → `shiftValuation`, `shiftInvoice`. | Requiere vínculo aprobado; misma cantidad no prueba coincidencia de documento. |
| Nuevas OT, lecturas, inspecciones, turnos, reservas, OC y recibos | PostgreSQL operativo de Panamá → aplicación → exportación/conciliación hacia Sheets. | Folio, actor, versión y comprobante idempotente gobiernan la escritura. Sheets sirve de intercambio y respaldo; no sobrescribe una transacción posterior. |
| Adjuntos / ID + tamaño + SHA-256 | Bucket privado y registro PostgreSQL de evidencias. | El archivo original se conserva; una copia reducida es otro objeto. TI verifica acceso y restauración de bytes. |
| Personas / ID del proveedor | Proveedor de identidad + membresía aprobada de Panamá. F01 sustenta puesto, suplencia y alcance. | Revocación se vuelve a comprobar en servidor. TI ejecuta altas autorizadas; el catálogo de puestos no concede permisos. |

La conciliación de combustible incluye únicamente intervalos completos y coincidentes
dentro del período. No prorratea sus bordes. Un conflicto de lecturas puede excluir
conservadoramente una unidad hasta revisión. Los promedios entre familias, por sí
solos, no determinan eficiencia ni elegibilidad de bonos.

## Puestos y accesos por revisar

Fuente del catálogo: TP-DOC-R06-I, I.03, ya incorporada en
`src/lib/panama-r06-positions.ts` y concordante con la captura aportada por Daniel.
No se recibió aquí una F01 firmada que permita afirmar asignaciones nominales
vigentes. Esta tabla prepara la revisión; no otorga accesos ni convierte 28 puestos
en 28 personas. Los alcances por proyecto/unidad se aprueban por persona.

| Código | Puesto | Espacio / perfil a validar |
| --- | --- | --- |
| TP-PER-001 | Gerencia General | Gerencia; aprobación de compras solo por autorización expresa. |
| TP-PER-002 | Dirección de Operaciones | Operaciones; aceptación de retorno separada de Taller. |
| TP-PER-003 | Gerencia de Proyectos y Contratos | Gestión y consulta del proyecto; alcance por validar. |
| TP-PER-004 | Responsable / Administración de Proyecto | Supervisión del proyecto; alcance por validar. |
| TP-PER-005 | Planeamiento y Control de Costos | Consulta y conciliación de costos; perfil específico por validar. |
| TP-PER-006 | Superintendencia de Movimiento de Tierras | Supervisor; sin permiso HSE implícito. |
| TP-PER-007 | Jefatura de Transporte y Acarreo | Supervisor; unidades y frentes autorizados. |
| TP-PER-008 | Despacho y Control de Producción | Captura y consulta de turnos; despacho sujeto a habilitación vigente. |
| TP-PER-009 | Supervisión de Turno / Frente | Supervisor; aceptación operativa según autoridad. |
| TP-PER-010 | Gerencia de Mantenimiento y Activos | Gestión de Taller; no implica aprobación financiera. |
| TP-PER-011 | Jefatura de Taller | `jefe_taller`; asignación y revisión técnica. |
| TP-PER-012 | Planeación de Mantenimiento / CMMS | `coordinador`; PM y calendario con plan aprobado. |
| TP-PER-013 | Supervisión Mecánica / Eléctrica | Revisión técnica; alcance frente a Jefatura por validar. |
| TP-PER-014 | Técnico de Mantenimiento de Equipo Pesado | `mecanico`; OT asignadas y evidencia de ejecución. |
| TP-PER-015 | Gestión de Llantas | Consulta/intervención de llantas; perfil y revisiones por validar. |
| TP-PER-016 | Compras y Abastecimiento | Bandeja de pedidos/OC; sin autoaprobación. |
| TP-PER-017 | Almacén y Repuestos | `almacen` + `canReceivePurchases`; recepción, reserva, entrega y devolución. |
| TP-PER-018 | Combustibles y Lubricantes | Captura de combustible y lecturas de sus equipos; alcance por validar. |
| TP-PER-019 | Gerencia HSE / SSOMA | Supervisor/Gerencia + `canReviewPanamaHse` explícito. |
| TP-PER-020 | Supervisión HSE de Proyecto | Supervisor + `canReviewPanamaHse` explícito. |
| TP-PER-021 | Gerencia de Administración y Finanzas | Consulta y conciliación financiera; permisos de factura/pago separados. |
| TP-PER-022 | Tesorería y Cuentas por Cobrar | Bandeja de pagos cuando aplique; no concede aprobación de OC. |
| TP-PER-023 | Contabilidad y Control Tributario | Bandeja de facturas; conciliación documental. |
| TP-PER-024 | Recursos Humanos y Nómina | No hay módulo de nómina en este alcance; no asignar Gerencia por defecto. |
| TP-PER-025 | Administración de Contratos y Valorizaciones | Partes aceptados, valorización y factura; alcance por validar. |
| TP-PER-026 | TI / Sistemas de Flota | Administración técnica aprobada; no firma compras ni libera HSE por su puesto. |
| TP-PER-027 | Operador de Equipo Pesado | `operador`; horómetro, falla e inspección de equipos asignados. |
| TP-PER-028 | Conductor de Camión Volquete / Acarreo | `operador`; lecturas y partes de sus unidades. |

La validación del padrón usa `scripts/import-hermes-roster.mjs` sin `--apply`.
Solo TI, con F01 y permisos aprobados, aplica el padrón. No hay invitaciones ni
contraseñas compartidas incluidas en esta entrega.

## Pendientes operativos concretos

| Pendiente observado | Siguiente paso / responsable propuesto |
| --- | --- |
| 25 planes PM; ninguno aprobado en el corte inspeccionado. | Taller revisa modelo/serie, tareas, revisión, intervalo y política; registra aprobación en la fuente autorizada. Planificación concilia el corte antes de programar. |
| Modelos sin checklist técnico aplicable, incluido Mack Granite en el resolver inspeccionado. | Taller aporta el documento específico y valida su revisión. No usar silenciosamente el checklist de otro equipo. |
| Series ausentes, ambiguas o distintas de la OT. | Operaciones/Taller verifican placa y Maestro de Equipos; el PDF conserva «por verificar» o rechaza el conflicto. |
| Catálogo real de repuestos sin SKU después de cabeceras. | Almacén prepara conteo firmado, SKU único, OEM conocido, unidad, ubicación y soporte. Finanzas valida la valuación. Usar `stock-opening-review.csv` para revisión previa, no como saldos aprobados. |
| F01 y matriz nominal no conciliadas. | Administración/TI presentan personas, puesto, suplencia, proyecto, unidades y capacidades al aprobador autorizado. |
| Umbrales de consumo y metas no aprobados. | Daniel define límites por familia/modelo y condiciones de operación; las alertas requieren revisión antes de decidir bonos. |
| Política distinta de la que refleja el maestro PM o corrección de cierre. | Taller confirma política y permisos, motivo y revisión de la fuente. El ensayo aritmético no habilita una edición destructiva de un cierre real. |
| Ensayo de recuperación administrada y capacidad del servicio. | TI identifica un destino separado autorizado, copia/archivo de evidencias y retención real disponible. Ejecutar allí, sin restaurar producción ni activar servicios pagados. |

## Cómo reproducir la verificación

Ejecutar desde un checkout limpio con las dependencias del repositorio:

```sh
npm test
npm run test:api
npm run build
HERMES_QA_EVIDENCE=/ruta/evidencia HERMES_PGLITE_ENTRY=/ruta/pglite/dist/index.js HERMES_QA_PREVIOUS_REPO=/ruta/base-d3f9091 HERMES_QA_CHROMIUM_EXECUTABLE=/ruta/chromium node scripts/qa-rollout/run.mjs
```

La suite no usa empleados ni existencias reales. Sus claves y contraseñas son
sintéticas y la red de los servicios se limita a loopback. El caso de capacidad
PGlite usa 60 equipos y 40 operadores, 20 técnicos, 8 supervisores, 8 planificadores,
6 jefes de Taller, 6 Almacén, 4 Compras, 4 Finanzas, 2 Operaciones y 2 TI.
Los últimos cuatro grupos se representan por las capacidades actuales de los
roles del servidor; sus nombres no crean privilegios de producción.

El registro distingue UI móvil de Chromium, teclado simulado mediante reducción
real del viewport, identidad simulada, motor PostgreSQL local y servicios
administrados. Los tiempos automáticos no acreditan una tarea humana de menos de
60 segundos ni rendimiento del teléfono físico, navegador instalado o red de mina.

## Recuperación y reversión

1. Conservar el despliegue anterior indicado arriba. Esta versión no cambia el
   esquema ni transforma registros reales; la reversión de código no exige una
   migración inversa.
2. En caso de incidente, TI determina el flujo afectado. Se pueden pausar rutas
   concretas con `HERMES_PAUSED_OPERATIONS` o el gateway con `HERMES_READ_ONLY=true`.
   Registrar los folios confirmados y pendientes antes de reactivar.
3. Volver al despliegue anterior de **hermes-panama**. No volver a una versión que
   carezca de identidad individual o que no comprenda los comprobantes actuales.
4. Verificar sesión, lectura de la misma OT, historial, reserva/saldo y acceso a
   adjuntos. Reintentar usando el mismo identificador de operación, no recapturar
   una compra o una salida que ya tenga folio confirmado.
5. Para pérdida de datos, restaurar primero en el destino separado autorizado:
   base, relaciones y archivo de objetos privados. Comparar cantidades y SHA-256;
   medir antigüedad del corte, tiempo hasta primera descarga y recuperación total.
   Solo después decidir recuperación del servicio productivo.

El ensayo local recupera OT, OC y recepción, reserva, comprobantes de reintento,
aprobaciones, archivos PNG/PDF, garantías y sus adjuntos, odómetro y bitácoras.
Detecta un archivo ausente o alterado. La retención contratada, RPO/RTO y recuperación
de Supabase administrado quedan sin acreditar hasta comprobar el entorno y los
respaldos reales. No se presupone que un respaldo de base incluya los bytes del
bucket privado.
