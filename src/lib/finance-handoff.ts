interface ShiftForHandoff {
  id: string;
  version: number;
  unit: string;
  date: string;
  shift: string;
  status: string;
  hours: number;
  initialHours: number;
  finalHours: number;
  reviewedBy: { name: string } | null;
  reviewedAt: string | null;
  client: string;
  support: string;
}

function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^[\t\r\n]|^\s*[=+@-]/.test(text) ? "'" + text : text;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function shiftHandoffCsv(part: ShiftForHandoff): string {
  if (part.status !== 'Aceptado por Supervisión' || !part.reviewedBy || !part.reviewedAt) {
    throw new Error('El parte debe estar aceptado por Supervisión antes de preparar el traspaso.');
  }
  const headings = ['Folio Hermes', 'Versión', 'Unidad TMF', 'Fecha del turno', 'Turno', 'Horómetro inicial',
    'Horómetro final', 'Horas aceptadas', 'Cliente', 'Referencia del soporte', 'Revisó', 'Fecha de revisión UTC', 'Estado de valorización'];
  const row = [part.id, part.version, part.unit, part.date, part.shift, part.initialHours, part.finalHours,
    part.hours, part.client, part.support, part.reviewedBy.name, part.reviewedAt, 'Pendiente de conciliar en VALORIZACION'];
  return '\uFEFF' + [headings, row].map((line) => line.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
