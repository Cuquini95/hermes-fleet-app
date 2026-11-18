import { jsPDF } from 'jspdf';
import { autoTable, type RowInput } from 'jspdf-autotable';
import type { WorkOrder, StatusLogEntry } from '../types/workorder';
import type { Equipment } from '../types/equipment';
import type { InventoryMovement } from './purchasing-api';
import type { OrderCosts } from '../components/workshop/PanamaWorkOrderCost';
import { photoUrls } from './averias';

interface DocumentInput {
  order: WorkOrder;
  equipment?: Pick<Equipment, 'model' | 'serial'>;
  history: StatusLogEntry[];
  movements?: InventoryMovement[];
  costs?: OrderCosts;
  notes?: string[];
  exportedAt?: Date;
}

const fields: Record<string, string> = {
  estado: 'Estado', mecanico_asignado: 'Asignación', progreso: 'Progreso', observaciones: 'Observaciones',
  costo_estimado: 'Costo estimado', prioridad: 'Prioridad', foto_url: 'Evidencia', programacion: 'Programación',
  entrega_tecnica: 'Entrega técnica', aceptacion_tecnica: 'Revisión de Taller', retorno_operativo: 'Operaciones', reincidencia: 'Reincidencia',
};
const text = (value: unknown) => String(value ?? '').replace(/→/gu, ' a ').replace(/\u0000/g, '').trim() || 'Sin dato';
const stamp = (value: string) => /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))
  ? new Date(value).toLocaleString('es-PA', { timeZone: 'America/Panama' }) : text(value);

export function workOrderDocumentRows(input: DocumentInput): RowInput[] {
  const { order: order, equipment, history, movements, costs } = input;
  const section = (label: string): RowInput => [{ content: label, colSpan: 2, styles: { fillColor: [225, 232, 246], fontStyle: 'bold' } }];
  const rows: RowInput[] = [
    section('Equipo y trabajo'),
    ['Equipo', order.unidad], ['Modelo', equipment?.model || 'Por verificar'], ['Serie / PIN', equipment?.serial || 'Por verificar'],
    ['Estado / prioridad', `${order.estado} / ${order.prioridad}`], ['Fecha de apertura', text(order.fecha)],
    ['Técnico asignado', order.mecanico_asignado || 'Sin asignar'], ['Descripción', text(order.descripcion)],
    ['Partes solicitadas', order.partes_necesarias || 'Sin solicitud registrada'],
    ['Observaciones', order.observaciones || 'Sin observaciones'], section('Entrega y aceptación'),
    ['Diagnóstico', order.execution?.diagnosis || 'Pendiente'],
    ['Prueba funcional', order.execution?.functionalTest || 'Pendiente'],
    ['Trabajo registrado', order.execution ? `${order.execution.laborHours == null ? 'Horas por verificar' : `${text(order.execution.laborHours)} h`} · ${order.execution.userName} · ${stamp(order.execution.submittedAt)}` : 'Pendiente'],
    ['Revisión de Taller', order.technical ? `${order.technical.userName} · ${stamp(order.technical.acceptedAt)}` : 'Pendiente'],
    ['Aceptación de Operaciones', order.operations ? `${order.operations.decision === 'accepted' ? 'Aceptada' : 'Devuelta'} · ${order.operations.userName} · ${stamp(order.operations.recordedAt)}\n${order.operations.notes}` : 'Pendiente'],
    section('Movimientos de repuestos'),
  ];
  if (movements === undefined) rows.push(['Movimientos', 'No verificados en esta exportación.']);
  else if (!movements.length) rows.push(['Movimientos', 'Sin movimientos registrados.']);
  else for (const item of movements) rows.push([`${item.kind} · ${item.partNumber}`, `${item.quantity} ${item.measurementUnit}\n${item.warehouse || 'Almacén por verificar'} · ${item.reference}\n${item.by} · ${stamp(item.at)}`]);
  rows.push(section('Costos documentados'));
  if (!costs) rows.push(['Costos', 'No incluidos en esta exportación.']);
  else {
    if (!costs.totals.length) rows.push(['Costos', 'Sin importes conciliados.']);
    for (const total of costs.totals) rows.push([costs.pending.length ? 'Subtotal conciliado' : 'Total documentado', `${total.currency} ${total.amount}`]);
    for (const line of costs.lines) rows.push([text(line.kind), `${line.currency} ${line.amount} · ${line.reference}`]);
    for (const pending of costs.pending) rows.push(['Pendiente de conciliar', pending.reason]);
  }
  rows.push(section('Evidencia vinculada'));
  const photos = photoUrls(order.foto_url);
  rows.push(...(photos.length ? photos.map((url, index) => [`Adjunto ${index + 1}`, url]) : [['Adjuntos', 'Sin adjuntos registrados.']]));
  rows.push(['Consulta de adjuntos', 'Los archivos originales se consultan en Hermes con una sesión autorizada. Este PDF conserva sus referencias.']);
  rows.push(section('Historial de cambios · más reciente primero'));
  if (!history.length) rows.push(['Historial', 'Sin eventos registrados.']);
  for (const event of history) rows.push([`${stamp(event.timestamp)}\n${event.changed_by} · ${event.role}`, `${fields[event.field] || event.field}\nAntes: ${text(event.old_value)}\nDespués: ${text(event.new_value)}`]);
  for (const note of input.notes ?? []) rows.push(['Alcance de la exportación', note]);
  return rows;
}

export function makeWorkOrderPdf(input: DocumentInput) {
  const doc = new jsPDF({ format: 'letter', compress: true });
  const order = input.order;
  const folio = order.folio || order.ot_id;
  const exported = (input.exportedAt ?? new Date()).toLocaleString('es-PA', { timeZone: 'America/Panama' });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  doc.setProperties({ title: `${folio} · ${order.unidad}`, author: 'Trans Plus' });
  autoTable(doc, {
    startY: 39, margin: { top: 39, bottom: 18, left: 12, right: 12 },
    body: workOrderDocumentRows(input), theme: 'grid', rowPageBreak: 'avoid',
    styles: { fontSize: 9, cellPadding: 2.5, overflow: 'linebreak', valign: 'top' },
    columnStyles: { 0: { cellWidth: 57 }, 1: { cellWidth: width - 81 } },
    didDrawPage: () => {
      doc.setTextColor(22, 34, 82).setFont('helvetica', 'bold').setFontSize(11);
      doc.text('TRANS PLUS · ORDEN DE TRABAJO', 12, 13);
      doc.setFontSize(13).text(doc.splitTextToSize(`${folio} · ${order.unidad}`, width - 24).slice(0, 2), 12, 21);
      doc.setFont('helvetica', 'normal').setFontSize(8);
      doc.text(`Exportado ${exported} · Panamá`, 12, 33);
      doc.setDrawColor(198, 205, 219).line(12, height - 14, width - 12, height - 14);
      doc.text('Las aprobaciones se muestran según su registro en Hermes.', 12, height - 9);
      doc.text(String(doc.getCurrentPageInfo().pageNumber), width - 12, height - 9, { align: 'right' });
    },
  });
  return doc;
}
