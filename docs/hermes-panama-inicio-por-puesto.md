# Hermes Panamá por puesto

Candidata para revisión del 18 de noviembre de 2026. Parte de [dfb6599](https://github.com/Cuquini95/hermes-fleet-app/commit/dfb65991078c18f3d4607292b19ec09ed3047dcb), versión vigente al iniciar. Las pruebas usan identidades y registros de ensayo.

El puesto R06 determina la pantalla de inicio. La sesión conserva el rol base, el proyecto TMF, las unidades y las facultades de la cuenta. Cada escritura mantiene su autorización en el servidor. La facultad Q25 de aprobación de OC corresponde a Dirección de Operaciones, con autorización individual.

## Puestos

La evidencia móvil por fila se registra con el código del puesto en `MÓVIL-INICIOS-R06` y la captura `inicio-tp-per-NNN.png`. El resultado identifica rol base, ruta y ancho. El F01 operativo queda pendiente para las 26 filas de Panamá.

| R06 | Entrada y rol probado | Primera acción comprobada | Traspaso o pendiente específico |
| --- | --- | --- | --- |
| 001 | Gerencia General · Gerencia | Abre Centro de mando | Disponibilidad y prioridades de TMF. Caja corporativa y margen completo requieren corte conciliado. |
| 002 | Dirección de Operaciones · Gerencia + aprobación OC | Abre OC por aprobar | Compras deja borrador. Dirección decide con Q25. Almacén recibe por partida después de la aprobación. |
| 003 | Proyectos y contratos · Gerencia | Consulta partes aceptados | Contratos usa parte, tarifa y soporte. Hitos, cambios y reclamos quedan por conciliar con su expediente. |
| 004 | Administración de Proyecto · Coordinación | Abre partes diarios | Despacho y Supervisión corrigen el parte para el corte de Proyecto. Recursos semanales requieren fuente acordada. |
| 005 | Control de costos · Coordinación | Abre Gastos | Almacén y Contabilidad concilian soporte y moneda. Presupuesto y comprometido por proyecto quedan por conciliar. |
| 006 | Movimiento de tierras · Supervisión | Abre disponibilidad de flota | Entrega mediciones a Control de Producción. Capacidad por frente requiere plan conciliado. |
| 007 | Transporte y acarreo · Supervisión | Abre Registro de Flete | Despacho recibe viaje y boleta. Cruce con báscula y remisión pendiente de fuente. |
| 008 | Despacho y producción · Coordinación | Abre asignaciones del turno | La asignación consulta restricciones. Supervisa el parte y concilia con REGISTRO. |
| 009 | Supervisión de turno · Supervisión | Abre partes por revisar | Acepta o devuelve a quien entregó. Retorno de equipo exige autorización, revisión técnica y condiciones HSE. |
| 010 | Mantenimiento y activos · Gerencia | Abre OT | Taller prioriza pendientes. Reincidencias y garantías se consultan por OT y folio; componentes por equipo. |
| 011 | Jefatura de Taller · Jefe de Taller | Abre solicitudes de repuestos | Valida SKU y cantidad. Envía disponible a Almacén y faltante a Compras. Confirma el trabajo técnico. |
| 012 | Planeación de mantenimiento · Coordinación | Abre programa PM | Taller coordina la ventana. Planeación concilia PM FLOTA y AJUSTES con la lectura validada. |
| 013 | Supervisión técnica · Coordinación | Filtra reparaciones en revisión | Jefatura cierra o devuelve al técnico. Confirmar en F01 si la persona de Supervisión también tiene facultad de revisión. |
| 014 | Mis órdenes · Mecánico | Abre OT asignadas | Envía evidencia de ejecución y solicita la pieza desde la OT. Jefatura recibe ambos registros. |
| 015 | Llantas y componentes · Coordinación | Consulta neumático por número de fuego | Vincula historial y equipo. Taller y Almacén concilian intervención y costo. |
| 016 | Compras · Gerencia | Abre pedidos | Prepara cotización y borrador; Operaciones aprueba. La prueba de esta cuenta devuelve 403 al intentar aprobar. |
| 017 | Almacén · Almacén + recepción | Abre solicitudes de OT | Reserva, entrega y devuelve contra OT. El saldo pendiente de compra se recibe por partida. |
| 018 | Combustible · México | Fuera de la candidata de Panamá | El despacho y su revisión operativa corresponden al proyecto mexicano. |
| 019 | Gerencia HSE · Gerencia + revisión HSE | Abre inspecciones por revisar | HSE gestiona bloqueos. Registro corporativo de incidentes y acciones pendiente de fuente. |
| 020 | Supervisión HSE · Supervisión + revisión HSE | Abre inspecciones por revisar | Revisa sticker y hallazgos. Despacho y Operaciones consultan el bloqueo vigente. |
| 021 | Finanzas · Gerencia | Abre cuentas por pagar | Contabilidad y Tesorería registran los movimientos con facultades distintas. Caja y cobros por conciliar. |
| 022 | Tesorería · Gerencia + pagos | Abre bandeja de pagos | Registra comprobante, moneda y saldo. Cobros TMF en MOVIMIENTOS y CIERRE con la cuenta oficial. |
| 023 | Contabilidad · Gerencia + facturas | Abre bandeja de facturas | Concilia OC, recepción, factura e impuesto por partida. Tesorería recibe la factura conciliada. |
| 024 | Recursos Humanos y Nómina · proceso autorizado | Fuera de la candidata de Panamá | Definir con RR. HH. quién consulta folio, versión y horas de partes aceptados. |
| 025 | Contratos y valorizaciones · Coordinación | Abre partes aceptados | Descarga el parte para VALORIZACION. Factura y cobro se cruzan en DOCUMENTOS COBRO y MOVIMIENTOS. Retenciones y observaciones por conciliar. |
| 026 | Sistemas de Flota · Operador | Consulta estado técnico y perfil | La vista muestra las fuentes disponibles y la versión cuando el entorno la informa. Gestión de identidades, recuperación y despliegue requieren sus permisos de plataforma. |
| 027 | Mi turno · Operador | Abre inspección | Inspección con foto a Taller cuando genera OT; parte a Supervisión. Barra inferior con Inspecciones en una línea. |
| 028 | Conductor de acarreo · Operador | Abre Registro de Flete | Preuso y parte desde el mismo inicio. Despacho concilia la unidad y boleta del proyecto Panamá. |

## Verificación de los recorridos

| Evidencia | Qué comprueba |
| --- | --- |
| `MÓVIL-PILOTO-INSPECCIÓN-OT-REPUESTO` | Foto privada y folio de inspección vinculados a la OT de prueba DZ203. Solicitud con stock y faltante de dos piezas. Reserva, salida y devolución en la misma OT. Retorno rechazado ante DVIR fallido y sticker rojo. HSE aprueba el reemplazo y Operaciones recibe el equipo. |
| `MÓVIL-DVIR-FOTOS` y `MÓVIL-REINICIO-SIN-SEÑAL` | Inspección y fotos en historial privado. Persistencia y reintento desde el dispositivo en el entorno aislado. |
| `hermes-purchasing.test.mjs` | Dos reservas simultáneas sobre el mismo stock, reintento y devolución vinculada a la salida original. |
| `API-COMPRAS-RECIBIR-PARCIAL` | Aprobación, recepción parcial, factura y pago con cuatro cuentas. Diferencias de moneda, impuesto, cantidad y precio quedan rechazadas. |
| `MÓVIL-TURNOS-ENTREGA-ACEPTACIÓN`, `MÓVIL-TURNOS-CONCILIACIÓN-REGISTRO` y `MÓVIL-VALORIZACIÓN-TMF-A-FACTURA` | Parte recibido por Supervisión, lectura frente a REGISTRO y consulta de valorización y factura con corte de prueba. Los responsables registran los pasos externos en sus maestros oficiales. |
| `API-TALLER-DVIR-PM`, `API-TALLER-STICKER-REVISIÓN-BLOQUEO` y pruebas de Taller | PM con plan y checklist de prueba; revisión separada y restricción HSE. El retorno operativo verifica nuevamente bloqueos activos. |
| `MÓVIL-PANTALLAS` y `MÓVIL-INICIOS-R06` | Anchos de 320, 360, 390 y 412 px, acciones al alcance y rutas según cuenta. |

Taller registra `Completado` tras la revisión técnica. La lista de OT muestra **Retorno pendiente** hasta la aceptación por Operaciones cuando corresponde. La operación se confirma con otra cuenta y se registra con actor, fecha y evidencia. PM conserva su cierre y reglas de conciliación.

## Pase a producción

Administración y TI deben conciliar el F01 vigente con el R06, correo confirmado, proyecto, unidades y facultades separadas de aprobación OC, recepción, HSE, factura y pago. El padrón consultado tiene titulares y alcances por confirmar. Tras la revisión autorizada, TI puede aplicar la migración de `position_code`, validar el importador del padrón en modo de revisión y ensayar el acceso con cada titular habilitado.

En la versión de prueba, la cuenta personal de Gerencia ya autorizada para aprobar OC abre Dirección de Operaciones mientras se registra el código R06. La consulta de cuentas por pagar de Finanzas de prueba usa datos simulados.

Las pruebas de la candidata usan el gateway y la aplicación de Hermes con datos aislados. Las transacciones oficiales, los permisos reales y la habilitación del dominio de producción requieren su propio pase autorizado.

Fuentes de contraste. [Matriz R06 por puesto](https://chatgpt.com/library?file_id=libfile_fde3_f-ea2c805f5e648191b782c5a5d3c57e24_91fd228871dc8191aca80e071848dd59&account_id=personal) · [Control Corporativo R06](https://drive.google.com/file/d/1tgB6lFL6WwL8fMAUU327xJDE8FAYGJxk/view) · [Piloto DZ203](https://chatgpt.com/library?file_id=libfile_fde3_f-46921d57e0848191b23ff56fe752f4e0_91fd228871dc8191aca80e071848dd59&account_id=personal).
