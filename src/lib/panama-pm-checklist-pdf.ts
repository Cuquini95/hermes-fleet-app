import { jsPDF } from 'jspdf';
import { autoTable, type RowInput } from 'jspdf-autotable';

export interface PrintablePmChecklist {
  unit: string;
  model: string;
  hours: number;
  sheet: string;
  capturedAt: string;
  approved: boolean;
  serial?: string;
  identityVerified?: boolean;
  revision?: string;
  folio?: string;
  sections: { title: string; tasks: { id: string; label: string; reference: string; observation: string }[] }[];
}

function printable(value: string) {
  return value.replace(/⚠\s*/gu, 'Atención · ').replace(/≥/gu, '>=').replace(/≤/gu, '<=')
    .replace(/≈\s*/gu, 'aprox. ').replace(/→/gu, 'a');
}

export function makePmChecklistPdf(checklist: PrintablePmChecklist) {
  const doc = new jsPDF({ format: 'letter', compress: true });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const edge = 12;
  const contentWidth = pageWidth - edge * 2;
  const date = new Date(checklist.capturedAt).toLocaleDateString('es-PA', { timeZone: 'America/Panama' });
  const hours = checklist.hours.toLocaleString('en-US');
  const title = `${checklist.unit} · ${checklist.model}`;
  doc.setProperties({ title: `Checklist de mantenimiento · ${checklist.unit} · ${hours} h`, author: 'Trans Plus' });

  const body: RowInput[] = checklist.sections.flatMap((section): RowInput[] => [
    [{ content: printable(section.title), colSpan: 5, styles: { fillColor: [225, 232, 246], textColor: [22, 34, 82], fontStyle: 'bold' } }],
    ...section.tasks.map(task => [task.id, printable(task.label), printable(task.reference), '', printable(task.observation)]),
  ]);
  let tableEnd = 65;

  autoTable(doc, {
    startY: 65,
    margin: { top: 65, bottom: 22, left: edge, right: edge },
    head: [['N.º', 'Trabajo a realizar', 'Referencia / medida', 'Resultado', 'Dato / observación']],
    body,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2, lineColor: [198, 205, 219], lineWidth: 0.16, valign: 'middle' },
    headStyles: { fillColor: [22, 34, 82], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: contentWidth - 93 },
      2: { cellWidth: 33 },
      3: { cellWidth: 21 },
      4: { cellWidth: 27 },
    },
    rowPageBreak: 'avoid',
    didDrawPage: ({ cursor }) => {
      tableEnd = cursor?.y ?? tableEnd;
      const page = doc.getCurrentPageInfo().pageNumber;
      doc.setTextColor(22, 34, 82).setFont('helvetica', 'bold').setFontSize(10);
      doc.text('TRANS PLUS · MANTENIMIENTO PANAMÁ', edge, 12);
      doc.setFontSize(13);
      doc.text(doc.splitTextToSize(title, contentWidth - 34).slice(0, 2), edge, 20);
      doc.text(`PM ${hours} h`, pageWidth - edge, 20, { align: 'right' });
      doc.setFont('helvetica', 'normal').setFontSize(8.5);
      doc.text(`OT ${checklist.folio ?? 'Sin orden vinculada'}    Fecha del servicio ___________`, edge, 32);
      doc.text(doc.splitTextToSize(`Serie / PIN: ${checklist.serial ?? 'Por verificar en el maestro de equipos'}`, contentWidth), edge, 38);
      doc.text('Horómetro inicial ___________    Horómetro final ___________    Técnico ________________', edge, 46);
      doc.text(`Revisión del catálogo: ${checklist.revision ?? 'Por verificar'} · Corte ${date}`, edge, 52);
      const review = !checklist.approved ? 'BORRADOR · PLAN POR APROBAR · Solo revisión de Taller'
        : !checklist.identityVerified ? 'SERIE POR VERIFICAR · Solo revisión de Taller' : 'Plan aprobado · Confirmar aplicabilidad y condiciones antes del servicio';
      const needsReview = !checklist.approved || !checklist.identityVerified;
      doc.setTextColor(needsReview ? 160 : 22, needsReview ? 35 : 34, needsReview ? 35 : 82);
      doc.text(doc.splitTextToSize(review, contentWidth), edge, 59);
      doc.setTextColor(22, 34, 82);
      doc.setDrawColor(198, 205, 219).line(edge, pageHeight - 14, pageWidth - edge, pageHeight - 14);
      doc.text(`Flota - Checklists PM · ${checklist.sheet}`, edge, pageHeight - 9);
      doc.text(String(page), pageWidth - edge, pageHeight - 9, { align: 'right' });
    },
  });

  let y = tableEnd + 8;
  if (y + 24 > pageHeight - 17) {
    doc.addPage();
    doc.setTextColor(22, 34, 82).setFont('helvetica', 'bold').setFontSize(13);
    doc.text(`${checklist.unit} · PM ${hours} h`, edge, 15);
    y = 26;
  }
  doc.setFont('helvetica', 'normal').setFontSize(9);
  doc.text('Hallazgos y seguimiento', edge, y);
  doc.setDrawColor(198, 205, 219).line(edge, y + 5, pageWidth - edge, y + 5);
  doc.text('Técnico __________________    Supervisor __________________    Recibe __________________', edge, y + 17);
  return doc;
}
