# Una lista de órdenes — Panamá, 18 de noviembre de 2026

La pantalla de Órdenes mostraba tarjetas operativas de Hermes y, debajo, un panel
independiente del Maestro de Taller. El segundo panel solo aparecía con «Todas»;
las órdenes del maestro no participaban en los mismos filtros.

Ahora Taller y Operaciones ven una sola lista, con tarjetas del mismo formato,
búsqueda y filtros de prioridad y estado para ambas fuentes. Se indica Hermes,
Maestro o ambas. Los filtros ya no necesitan una barra horizontal. Los registros
exclusivos del maestro abren su ficha en una página completa, sin acciones de edición.

La ficha del maestro comparte encabezado, estado y tarjeta de información con
las órdenes de Hermes. Sustituye el cuadro emergente anterior. Tiene URL propia,
admite recarga directa y vuelve a la lista. Modelo y serie proceden del padrón
autorizado del equipo; los campos que no aporta el maestro quedan sin dato.
El progreso ausente no se convierte en 0 %. Los controles originales se conservan
en los datos del registro y sus pendientes se expresan con lenguaje sencillo.
Si la referencia ya tiene una única orden operativa del mismo equipo, se abre
esa ficha existente. La consulta no crea, importa ni habilita una orden editable.

Una coincidencia exacta de referencia y equipo se muestra una vez. Se conserva
el registro operativo y se avisa de diferencias de estado o prioridad. Copias
idénticas del maestro no agregan tarjetas; las variantes contradictorias quedan
disponibles para consulta. Referencias ambiguas o de equipos distintos no se
unen por descripción o similitud. No se fabrican fecha, prioridad o responsable.

La lista mantiene los registros de la fuente disponible si falla la otra y se
identifica como parcial. Reintentar actualiza ambas fuentes. Un cambio de cuenta,
rol o alcance retira el resultado anterior; cada consulta sigue pasando por la
autorización del servidor y se limita nuevamente al alcance del usuario.

Los mecánicos conservan su lista de órdenes asignadas y sus permisos anteriores.
México conserva su pantalla. No hay escrituras de negocio, migraciones,
asignaciones ni aprobaciones nuevas. Combustible sigue deshabilitado en Panamá.

Verificación del cambio de apertura: compilación correcta, 509 pruebas de
aplicación y 209 de API. En una réplica HTTPS con identidades y órdenes ficticias
se comprobaron teléfono (320, 360, 390 y 412 px), tableta (768 px), texto al 200 %,
enlace directo, recarga, regreso, fallos y reintento, permisos de Coordinación y
Mecánica, coincidencia con una OT operativa y descarga de su PDF. Siete casos de
navegador pasaron, sin desbordamiento horizontal ni escrituras de negocio.
Se revisaron visualmente las dos fichas. Estas pruebas no equivalen a una sesión
operativa autenticada en producción ni a una prueba en un teléfono físico.
