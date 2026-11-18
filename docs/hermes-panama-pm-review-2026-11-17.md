# Hermes Panamá — revisión de planes PM

Continuación del incremento `60d8054853aa326c0c0d728b91763ee02772a9e5`.
Fecha de trabajo: 17 de noviembre de 2026, Panamá.

## Operación

En **PM → Revisar planes**, Taller y Planificación pueden buscar por equipo,
modelo o serie, ver los pendientes concretos y descargar la revisión completa.
La lista compara flota, PM FLOTA, AJUSTES, Maestro de Equipos y catálogo técnico.
Conserva las fechas de corte y la revisión SHA-256 del documento aplicable.

Detecta planes ausentes o duplicados, aprobación pendiente, identidad ausente o
duplicada, serie sin verificar, modelos contradictorios, intervalos inválidos,
checklists sin cobertura y saldos de horas contradictorios. Una fuente ausente
produce una revisión parcial visible. Un fallo de actualización retira los datos
anteriores para no presentar una aprobación antigua como recién verificada.

El responsable corrige la fuente autorizada y vuelve a consultar. El botón de
actualización lee el corte disponible: no fuerza ni promete una sincronización
de Sheets. El informe no sustituye la revisión técnica ni la evidencia de una
aprobación. No aprueba planes ni crea órdenes. El circuito existente sigue
validando la aprobación y el estado de los datos en el servidor al programar.

El endpoint `GET /hermes-api/api/panama/pm-review` usa la sesión de Panamá,
los roles de consulta de mantenimiento y el alcance de unidades de la persona.
La proyección de país/proyecto precede a la revisión. No devuelve filas de
otros equipos ni tareas completas del catálogo. El CSV neutraliza fórmulas
en texto importado de los maestros. Ningún dato real del informe se incorpora
al repositorio.

## Acceso del personal

El proyecto Vercel `hermes-panama` tenía protección SSO en todas las direcciones.
Se cambió a `all_except_custom_domains`: el dominio principal sirve el acceso
individual de Hermes, mientras las vistas previas y direcciones automáticas
del despliegue siguen protegidas por Vercel. Se conservan los permisos del
servidor, las sesiones individuales y el bloqueo de las identidades ficticias
en producción.

Comprobación externa sin cookies: `/login` respondió 200 con HTML de Hermes;
sesión y rutas privadas respondieron 401 con `Sesión inválida`. La dirección
automática de producción y la vista previa respondieron 401 con protección
de Vercel. Se comprobó también el login y el rechazo del maestro PM desde
el navegador. No se probó una contraseña de empleado ni se crearon cuentas.

La reversión de esa configuración es restaurar
`ssoProtection.deploymentType = "all"` únicamente en el mismo proyecto. La
reversión del código es volver al despliegue de `60d8054`; no hay migraciones
ni escrituras de negocio que revertir en este incremento.

## Personas y datos pendientes

Se consultaron el organigrama R06 actualizado el 17 de noviembre de 2026 y
la plantilla F01. El primero conserva como pendientes las asignaciones
locales TMF; la segunda es un formato en blanco. Los nombres corporativos
no acreditan por sí solos una cuenta local o un nombramiento vigente.
No se cambiaron membresías, capacidades ni saldos de inventario.

Taller conserva la aprobación de los planes; Almacén y Finanzas validan el
conteo y su valuación; Administración/TI concilian personas y accesos con
F01 y la matriz de autoridad. El ensayo de recuperación administrada sigue
requiriendo un destino separado autorizado y los respaldos disponibles.

## Verificación

Pruebas del servidor: `tests/api/hermes-panama-pm-review.test.mjs`.
Exportación: `src/lib/panama-pm-review.test.ts`.
Aceptación móvil dirigida:

```sh
HERMES_QA_CHROMIUM_EXECUTABLE=/ruta/chromium HERMES_QA_EVIDENCE=/ruta/evidencia node scripts/qa-rollout/verify-panama-pm-review.mjs
```

El ensayo usa fuentes e identidad sintéticas en loopback. Verifica anchos
reales de 320/360/390/412 px, texto al 200 %, búsqueda por serie, tres descargas,
cambio de aprobación en la fuente ficticia, fallo/reintento sin aprobación
obsoleta visible y alcance de la acción con viewport reducido a 320 px de alto.
La reducción de altura simula el espacio del teclado; no acredita un teclado
nativo ni una prueba de uso humano en mina.
