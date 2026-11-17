# Verificación aislada de Hermes Fleet

Desde el repositorio con sus dependencias instaladas, ejecuta `node scripts/qa-rollout/run.mjs`. Requiere Node 24, OpenSSL y, para navegador, Chromium con Playwright y los comandos `pdftotext` y `pdfinfo` de Poppler.

- `HERMES_QA_REPO` permite probar otro checkout local.
- `HERMES_QA_EVIDENCE` indica el directorio de salida de `verificacion.json`, capturas y PDF.
- `HERMES_QA_CHROMIUM_EXECUTABLE` permite indicar el binario de Chromium.
- `--api-only` omite navegador y compilación de la interfaz. `--identity-only` limita el alcance al ingreso. `--workshop-only` incluye identidad y Taller.

La prueba compila la app e invoca los handlers del checkout con un proveedor de identidad, una hoja y almacenamiento sintéticos. El servidor escucha en `127.0.0.1` con un certificado temporal. El navegador bloquea solicitudes a otros orígenes y el servidor bloquea salidas de `fetch` al exterior. Las alertas se registran en memoria. Las pruebas no necesitan credenciales ni datos reales.

La carga ejecuta dos cohortes de 28 y 100 identidades sintéticas distintas por HTTPS loopback. Mide arranque y operaciones por rol, incluidas escrituras concurrentes de avería y avance de OT, y coteja los reintentos con las filas persistidas. Los seis roles se prueban en sesiones separadas en móvil a 360 y 390 px. Los resultados identifican el commit y si el checkout tenía cambios sin confirmar. Comprueba los servicios del entorno de despliegue por separado antes de habilitar escrituras reales.

Para usar las migraciones reales del registro y verificar los folios visibles de OT, ejecuta la misma carga con PGlite instalado (verificado con 0.3.14):

```sh
HERMES_PGLITE_ENTRY=/ruta/absoluta/pglite/dist/index.js HERMES_QA_EVIDENCE=/ruta/de/evidencia \
  node scripts/qa-rollout/verify-panama-concurrency.mjs
```

El reporte `concurrencia-postgres.json` distingue tiempos de arranque y de acciones, percentiles, conflictos recuperados y resultados de persistencia. Postgres usa una base descartable en memoria. La identidad, el inventario y los maestros siguen siendo sintéticos.

## Stock por almacén en Panamá

Para habilitar el piloto conectado, el catálogo operativo `12 Inventario Rep.` necesita un corte aprobado con SKU, unidad de medida, compatibilidad, existencia física inicial y una columna con el encabezado `Almacén` o `Bodega`. Registra una sola fila por combinación SKU–almacén. Si un SKU está en más de un almacén, conserva su unidad de medida y sus reglas de compatibilidad en cada fila. La columna `Ubicación` puede identificar un estante y no sustituye el almacén. Una fila antigua sin almacén puede mostrar su existencia física, pero las reservas deben esperar la identificación del almacén.

En el piloto, usa una OT y una OC autorizadas en un entorno descartable. Comprueba que el disponible sea la existencia física menos el saldo de las reservas. Desde Recepciones, registra una guía de proveedor contra una partida aprobada y su almacén. Verifica que la recepción parcial disminuya el tránsito de esa guía y aumente la existencia del destino. Guarda las referencias de despacho, recepción y cancelación en el historial de movimientos para poder cuadrar ambos registros.

## Restauración y reversión de versión

Usa PGlite 0.5.16 y dos checkouts limpios. Ejecuta el ensayo desde la candidata y apunta al código de la versión anterior.

```sh
HERMES_PGLITE_ENTRY=/ruta/absoluta/a/pglite/dist/index.js \
HERMES_QA_PREVIOUS_REPO=/ruta/absoluta/al/checkout/anterior \
node scripts/qa-rollout/verify-panama-restore.mjs
```

El ensayo restaura la base sintética y una copia separada de la foto de una OT y del PDF de garantía. Compara tamaño y SHA-256 con el registro restaurado, comprueba ambas descargas como Coordinación y Jefe de Taller y detecta si el archivo falta o está dañado. Mide el tiempo desde el inicio de la restauración hasta completar las descargas.

Con el checkout anterior, el ensayo aplica las migraciones adicionales que correspondan y verifica la consulta de OT, aprobación y recepción de OC, saldos y adjuntos sobre la base restaurada. La candidata recupera la avería registrada por la versión anterior sin duplicar el folio y conserva las bitácoras. Los tiempos corresponden a PGlite y archivos sintéticos.
