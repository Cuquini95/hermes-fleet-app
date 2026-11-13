# Hermes Panamá · Gastos y traspaso contable

Los gastos nuevos de Panamá requieren una entidad emisora del catálogo de compras aprobado. Hermes conserva la moneda de esa entidad, la fecha del documento y el importe de impuesto consignado en el documento. El formulario deja ingresar ese importe y no calcula una tasa fija. Las partidas y los repartos conservan sus centavos. La captura guarda un recibo y sus repartos como Pendiente. La revisión del grupo registra decisión, actor, fecha y motivo. Cada gasto aprobado pasa al reporte de su entidad y moneda.

El catálogo base de Panamá contiene a TRANSPLUS, S.A. en USD. TI puede sustituirlo con `HERMES_PURCHASE_ISSUERS_JSON` si cambia el catálogo autorizado. En los borradores de compra, Gerencia registra el descuento y el ITBMS del documento, incluido cero para una operación exenta. Si el proveedor aún no está en el catálogo, Gerencia puede identificarlo en el borrador con los datos del documento. Para aprobar la orden se debe seleccionar el proveedor del catálogo y registrar el soporte de aprobación vigente.

TI mantiene `HERMES_PANAMA_EXPENSE_REVIEWER_IDS` con los identificadores de las personas habilitadas por Contabilidad. La revisión exige Gerencia, alcance sobre todo el reparto e identidad distinta del autor. El titular del permiso se confirma con Contabilidad. Para activar adjuntos, validar el destino autorizado del proyecto y la conservación del recibo. Las pruebas aisladas sustituyen esa integración.

Contabilidad mantiene `HERMES_PANAMA_EXPENSE_CLOSED_THROUGH` en formato `AAAA-MM` con el último mes efectivamente cerrado. Sin confirmación del corte, Hermes exige que los movimientos correspondan al mes en curso. Las correcciones de registros aprobados o cerrados se tramitan en el maestro contable con el folio original, la entidad, la moneda, la fecha, el soporte, la razón y el actor. Los registros históricos sin moneda o entidad se muestran como pendientes de conciliar y no forman parte de un total o PDF verificado.

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

Coordinación y Gerencia pueden descargar un parte aceptado desde Relevo. El CSV lleva folio y versión, fecha y turno, unidad, horómetros, horas aceptadas, cliente, soporte y revisión. Queda pendiente de conciliación en VALORIZACION. Hermes ofrece acceso a los maestros para la conciliación. Para cerrar el traspaso conectado, se requiere comprobar el mismo folio y saldo en una copia autorizada de cada fuente.
