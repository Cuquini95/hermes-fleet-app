# Verificación aislada de Hermes Fleet

Desde el repositorio con sus dependencias instaladas, ejecuta `node scripts/qa-rollout/run.mjs`. Requiere Node 24, OpenSSL y, para navegador, Chromium con Playwright y los comandos `pdftotext` y `pdfinfo` de Poppler.

- `HERMES_QA_REPO` permite probar otro checkout local.
- `HERMES_QA_EVIDENCE` indica el directorio de salida de `verificacion.json`, capturas y PDF.
- `HERMES_QA_CHROMIUM_EXECUTABLE` permite indicar el binario de Chromium.
- `--api-only` omite navegador y compilación de la interfaz. `--identity-only` limita el alcance al ingreso. `--workshop-only` incluye identidad y Taller.

La prueba compila la app e invoca los handlers del checkout con un proveedor de identidad, una hoja y almacenamiento sintéticos. El servidor escucha en `127.0.0.1` con un certificado temporal. El navegador bloquea solicitudes a otros orígenes y el servidor bloquea salidas de `fetch` al exterior. Las alertas se registran en memoria. Las pruebas no necesitan credenciales ni datos reales.

El arranque concurrente mide 100 identidades distintas vía HTTP en el mismo proceso local. Los seis roles se prueban en sesiones separadas en móvil a 360 y 390 px. Los resultados identifican el commit y si el checkout tenía cambios sin confirmar. Comprueba los servicios del entorno de despliegue por separado antes de habilitar escrituras reales.
