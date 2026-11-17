# Hermes Panamá · Gastos y traspaso contable

Los gastos nuevos de Panamá requieren una entidad emisora del catálogo de compras aprobado. Hermes conserva la moneda de esa entidad, la fecha del documento y el importe de impuesto consignado en el documento. El formulario deja ingresar ese importe y no calcula una tasa fija. Las partidas y los repartos conservan sus centavos. La captura guarda un recibo y sus repartos como Pendiente. La revisión del grupo registra decisión, actor, fecha y motivo. Cada gasto aprobado pasa al reporte de su entidad y moneda.

El catálogo base de Panamá contiene a TRANSPLUS, S.A. en USD. TI puede sustituirlo con `HERMES_PURCHASE_ISSUERS_JSON` si cambia el catálogo autorizado. En los borradores de compra, Gerencia registra el descuento y el ITBMS del documento, incluido cero para una operación exenta. Si el proveedor aún no está en el catálogo, Gerencia puede identificarlo en el borrador con los datos del documento. Para aprobar la orden se debe seleccionar el proveedor del catálogo y registrar el soporte de aprobación vigente.

TI mantiene `HERMES_PANAMA_EXPENSE_REVIEWER_IDS` con los identificadores de las personas habilitadas por Contabilidad. La revisión exige Gerencia, alcance sobre todo el reparto e identidad distinta del autor. El titular del permiso se confirma con Contabilidad. Para activar adjuntos, validar el destino autorizado del proyecto y la conservación del recibo. Las pruebas aisladas sustituyen esa integración.

Contabilidad mantiene `HERMES_PANAMA_EXPENSE_CLOSED_THROUGH` en formato `AAAA-MM` con el último mes efectivamente cerrado. Sin confirmación del corte, Hermes exige que los movimientos correspondan al mes en curso. En Gastos, el autor puede proponer un ajuste de importe para control interno sobre un gasto aprobado de un período confirmado como cerrado. Una persona distinta, con la autorización de revisión vigente, aprueba o rechaza. La bitácora guarda el folio, la referencia del soporte, los dos importes, motivo, autor, revisor y fechas. Un ajuste aprobado se refleja en el detalle de control interno. La factura, el registro original y los reportes oficiales se conservan. Los movimientos contables se tramitan en su maestro autorizado. Los registros históricos sin moneda o entidad se muestran como pendientes de conciliar y no forman parte de un total o PDF verificado.

En la ficha de OT, Gerencia consulta el costo documentado por moneda. Los repuestos usan la valuación guardada en la salida y sus devoluciones revierten ese mismo valor. Una factura externa requiere un gasto de Servicio aprobado por un revisor independiente, el número de factura, el registro fiscal del proveedor y un vínculo a la unidad de la OT. El importe del servicio incluye el impuesto que consta en el documento. La vista identifica las partidas pendientes de conciliación.

La mano de obra requiere horas aceptadas por Taller y una valuación documentada por Contabilidad. La entrada privada en `HERMES_PANAMA_LABOR_VALUATIONS_JSON` usa `ot` (ID interno), `unit`, `executorId`, `acceptedAt` (marca exacta de aceptación), `hours`, `hourlyRate`, `currency` (USD o PAB) y `reference`. Hermes espera una sola entrada por aceptación y verifica que las horas coincidan con la OT. Sin esa autorización, presenta la mano de obra como pendiente.

Contabilidad captura la moneda, el ITBMS y el total de la factura de compra, más la cantidad y el precio facturado de cada partida aprobada. Hermes verifica las cantidades contra la OC y sus remisiones y conserva los identificadores de esas recepciones. Si falta el cruce o cambia una remisión antes del pago, Contabilidad debe volver a verificar la factura. Hermes conserva el asiento original y registra la conciliación anterior en la bitácora. Las OC ya pagadas conservan su historial.

## Campos nuevos en 02 Gastos

| Columna | Dato |
|---|---|
| V | Entidad |
| W | Moneda original |
| X | Etiqueta del impuesto |
| Y | Fecha de documento |
| Z | ID del revisor |
| AA | Fecha y hora de revisión |
| AB | Motivo de revisión |
| AC | Fecha y hora de captura |

## Entregas a los maestros

1. Operaciones confirma horas, unidad y corte en Disponibilidad TMF, pestaña VALORIZACION.
2. Facturación traslada cliente, corte, folio de origen, comprobante, importe y moneda a Rentabilidad por Unidad, pestaña DOCUMENTOS COBRO.
3. Tesorería registra cobro efectivo, referencia, fecha, moneda e importe en MOVIMIENTOS. Contabilidad confirma el saldo en CIERRE.

Coordinación y Gerencia pueden descargar un parte aceptado desde Relevo. El CSV lleva folio y versión, fecha y turno, unidad, horómetros, horas aceptadas, cliente, soporte y revisión. Queda pendiente de conciliación en VALORIZACION. Desde el parte aceptado, Gerencia puede abrir la valorización por equipo y período y la factura asociada. La consulta indica las horas del parte por separado de los totales del período y conserva el estado del documento maestro.

El cruce es de solo lectura. El servicio usa la pestaña VALORIZACION de Disponibilidad TMF mediante `HERMES_PANAMA_TMF_SHEET_ID` y la pestaña DOCUMENTOS COBRO de Rentabilidad por Unidad mediante `HERMES_PANAMA_FINANCE_SHEET_ID`. Este último identifica el libro de facturación, distinto de Control de Costos por Máquina. Ambas fuentes requieren permiso de lectura para la cuenta de servicio de Panamá.

Contabilidad proporciona los vínculos aprobados en `HERMES_PANAMA_SHIFT_BILLING_LINKS_JSON`, un arreglo privado del servidor. Cada vínculo lleva `partId`, `version`, `unit`, `reviewedAt` en formato UTC tal como figura en el parte, `periodStart` y `periodEnd` en AAAA-MM-DD, y `reference` con el respaldo del cruce. `documentLineId` es el valor exacto de ID línea en DOCUMENTOS COBRO cuando la factura ya está asociada. Hermes exige una sola valorización para la unidad y el período y comprueba el ajuste y la tarifa. Si falta la factura, el maestro no responde o los registros requieren revisión, Hermes muestra el estado en el propio parte. El vínculo no se infiere por fecha, número de factura o similitud de textos.
