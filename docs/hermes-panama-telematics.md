# Lecturas de flota mixta en Hermes Panamá

En **Horómetro**, selecciona la unidad y revisa **Lecturas por origen**. Las horas y los kilómetros se muestran por separado. El corte conserva el valor, unidad original, momento de medición y referencia de cada lectura telemática. El historial agrupa los datos por mes de Panamá.

Hermes prioriza una lectura telemática vigente y muestra el respaldo manual cuando existe. Si falta la lectura vigente, muestra el respaldo manual disponible, con su fecha, o el último turno del REGISTRO para horas. Los cortes del REGISTRO muestran la fecha y el turno del parte. La vigencia telemática se evalúa contra el plazo autorizado para cada fuente. La vista de consulta no modifica los horómetros acumulados, el PM ni el REGISTRO.

## Habilitación del piloto conectado

1. Confirma el proveedor y su autorización, el código de cada unidad en el inventario TMF, el tipo de contador y la vigencia por fuente. La flota admite horas o kilómetros, según esa asignación.
2. Configura en servidor `HERMES_PANAMA_TELEMATICS_SOURCES_JSON` con `sources` y `odometerUnits`. Cada fuente lleva `key`, `label`, `maxAgeHours` y `units`. Las claves de `units` son códigos exactos del inventario y sus valores son arreglos de `h` o `km`. Agrega a `odometerUnits` los equipos aprobados para capturar respaldo manual en kilómetros. Un listado de fuentes vacío conserva la consulta de Hermes y del REGISTRO.
3. El publicador autorizado envía el corte al almacenamiento privado existente de Panamá, en `hermes_panama_source_snapshots` con `source = telematics`, `captured_at` como timestamp ISO 8601 y `rows` como arreglo de objetos. Cada objeto lleva `project = tmf-panama`, `source` con la clave autorizada, `unit`, `measure` (`h`, `min`, `km` o `mi`), `value`, `measuredAt` con zona horaria y `reference`. El publicador conserva el intervalo histórico aprobado para que aparezca en el selector mensual. Hermes no contacta proveedores directamente.
4. Aplica la migración del registro privado de odómetro en el entorno autorizado. Verifica una unidad de horas y una de kilómetros, un corte vencido, una lectura manual con respaldo y la exclusión por unidad asignada. La captura usa el permiso existente de horómetros.
