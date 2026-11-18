# Tiempos de mantenimiento — 18 de noviembre de 2026

Ruta: Inicio → Tiempo caído, `/panama/tiempo-caido`. Taller y Operaciones conservan su autorización y alcance por equipo. Consulta y CSV, sin escrituras de negocio ni cambios de esquema, permisos, planes o inventario.

## Qué mide

El tiempo caído existente usa inicio confirmado de parada y retorno aceptado por Operaciones después de una aceptación técnica independiente. La aceptación técnica por sí sola no termina la parada. Las OT del mismo equipo superpuestas o contiguas forman una sola parada continua. Se conserva el desglose por turno cuando existe horario configurado; no se inventa un turno.

Se añaden horas calendario por estado: pendiente de reparación, en reparación, esperando repuesto, revisión técnica y aceptación de Operaciones. El reloj procede de `OT_STATUS_LOG`: hora UTC válida, autor individual, rol admitido y transición reconocida. Un hueco, vínculo ambiguo, cambio simultáneo contradictorio o cadena incompleta queda sin estado verificable. Las copias idénticas se omiten y se informan. No se aplica el estado actual hacia atrás. En OT simultáneas, estados distintos se clasifican como simultáneos; un tramo desconocido prevalece como desconocido. No se asigna una prioridad arbitraria que infle el tiempo esperando piezas o reparando.

Cobertura de estados = segundos clasificados / segundos medidos. Los estados simultáneos y desconocidos no cuentan en el numerador. Las paradas sin inicio o retorno verificables se muestran aparte: la cobertura de estados no prueba cobertura de toda la flota. Una ventana sin intervalos verificados muestra ausencia de datos, no «0 horas».

## MTTR registrado

Duración calendario completa acumulada / número de paradas correctivas continuas por equipo con retorno aceptado dentro de la ventana. Incluye esperas y aceptación; no equivale a horas de labor del mecánico. Las paradas iniciadas antes del período aportan su duración completa si su retorno cae dentro del período. Por eso el numerador de MTTR puede exceder el tiempo caído recortado al período.

Se excluyen paradas abiertas, las que incluyen PM, tipo ausente, vínculo de OT ambiguo y retorno fuera del período. Los intervalos sin confirmar se informan por separado. Las exclusiones solo consideran paradas que tocan la ventana, no todo el histórico. La cohorte, folios, horas inicial/final y numerador se pueden revisar y exportar. El resultado describe la muestra registrada; no acredita el desempeño de toda la flota. Sin cohorte elegible el promedio es nulo.

Las fechas se interpretan en Panamá, desde medianoche inclusive hasta la medianoche posterior exclusiva, o hasta el instante de consulta cuando se incluye hoy. Se admiten hasta 31 días, además de Hoy, 7 y 15 días. El CSV conserva segundos sin redondear, ventana, instante de consulta, filtro y pendientes. Neutraliza fórmulas en textos externos. Una consulta fallida elimina cifras y descarga anteriores; cambiar de identidad, rol, proyecto o alcance desmonta el resultado previo.

## Indicadores que siguen condicionados a datos

| Indicador | Evidencia necesaria | Decisión de este incremento |
| --- | --- | --- |
| MTBF | Horas efectivas de operación, población de fallas completa, mismo equipo y período, reglas aprobadas de qué constituye una falla | No se calcula con tiempo calendario ni solo con OT cerradas. |
| Disponibilidad del período | Horas de producción programadas aprobadas y paradas que se solapan con esa programación | El calendario de reparación no sustituye las horas de producción. Se conserva la disponibilidad de despacho existente como fotografía del estado actual. |
| Cumplimiento PM | Planes y vencimientos aprobados, cohorte debida completa y PM aceptados trazables | No se presenta 0% con planes sin aprobar o histórico vacío. |
| Metas / semáforos | Aprobación de Daniel y definición por familia / operación | No se inventan umbrales. |

Al revisar la base durante este trabajo: `ORDENES_TRABAJO` y `OT_STATUS_LOG` tenían una fila de negocio cada una; `05 Historial PM` y `04B Registro Horómetros` solo cabecera. Es una lectura de preparación, no una certificación de que las capturas históricas de maestros estén completas. No se modificaron esos registros para fabricar indicadores.

## Verificación y límites

- Pruebas de API: partición de seis horas, espera, historia parcial, solapamientos, duplicados, autores, límites de fecha, numerador no recortado, exclusiones, permisos y lectura fallida sin escritura.
- Prueba de teléfono: `scripts/qa-rollout/verify-panama-maintenance-metrics.mjs`, solo réplica HTTPS local y datos ficticios, 320/360/390/412 px, texto al 200%, altura reducida, Hoy/7/15 y fecha exacta, filtro de equipo, error/reintento y tres descargas.
- Estas pruebas no equivalen a validación humana de tiempos, teléfono físico, continuidad sin conexión nueva ni restauración administrada. Los ensayos previos de recuperación siguen identificados por su entorno y versión.

Definiciones consultadas: [IBM MTTR](https://www.ibm.com/think/topics/mttr), [IBM MTBF](https://www.ibm.com/think/topics/mtbf). Las fórmulas y ejemplos de Hermes se verifican mediante aritmética independiente. La decisión de agrupar OT solapadas, seleccionar retornos por período y publicar cobertura es propia de este contrato operativo.
