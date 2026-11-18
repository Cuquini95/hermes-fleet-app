# Panamá sin combustible — 18 de noviembre de 2026

Daniel confirmó que el proyecto Panamá no lleva combustible por el momento.
`src/data/project-features.js` desactiva ese módulo exclusivamente para
`tmf-panama`. México conserva el comportamiento anterior.

Se retiran del uso de Panamá las tarjetas de consumo, diésel por familia,
briefing de combustible, accesos de operador, pestaña de Datos y análisis de
combustible en pantalla y PDF. Las lecturas de combustible se omiten en esos
flujos, en Mis reportes y en el historial personal. Un enlace antiguo a
`/diesel` redirige al inicio del usuario. El servidor comunica la captura como
deshabilitada y rechaza nuevos despachos incluso si existe una bandera anterior
que los habilitaba. Los pilotos de Panamá siguen la misma decisión.

Se conservan los registros existentes y el código de conciliación y análisis
para una futura adopción autorizada. No hay borrados, migraciones ni cambios de
México. Los gastos históricos mantienen su clasificación contable y no se
reescriben. El resto del mantenimiento, PM y tiempos de parada continúa vigente.
