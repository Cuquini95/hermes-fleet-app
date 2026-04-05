import type { PMPart } from '../data/pm-parts-catalog';

interface PrintPMOrderData {
  otId: string;
  date: string;
  unidad: string;
  model: string;
  pmLevel: string;
  levelsIncluded: string[];
  horometro: number;
  estimatedHours: number;
  mecanico: string;
  autorizadoPor: string;
  observaciones: string;
  parts: PMPart[];
}

export function printPMOrder(data: PrintPMOrderData): void {
  const partsRows = data.parts
    .map(
      (p, i) =>
        `<tr>
          <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${i + 1}</td>
          <td style="padding:6px 8px;border:1px solid #ccc;font-family:monospace;font-size:12px">${p.partNumber}</td>
          <td style="padding:6px 8px;border:1px solid #ccc">${p.description}</td>
          <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${p.quantity}</td>
          <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${p.unit}</td>
          <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">${p.category}</td>
          <td style="padding:6px 8px;border:1px solid #ccc;text-align:center">☐</td>
        </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>OT ${data.otId} — PM ${data.pmLevel}</title>
  <style>
    @media print { body { margin: 0; } @page { margin: 1cm; } }
    body { font-family: Arial, sans-serif; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #162252; padding-bottom: 12px; margin-bottom: 16px; }
    .logo { font-size: 24px; font-weight: 900; color: #162252; }
    .logo-sub { font-size: 11px; color: #666; }
    .ot-id { font-size: 20px; font-weight: 700; color: #162252; text-align: right; }
    .ot-type { font-size: 13px; color: #2563EB; font-weight: 600; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 20px; font-size: 13px; }
    .info-grid dt { color: #666; font-weight: 500; }
    .info-grid dd { margin: 0; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    thead { background: #162252; color: white; }
    thead th { padding: 8px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; }
    tbody tr:nth-child(even) { background: #f8f9fa; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 40px; }
    .sig-box { border-top: 2px solid #1a1a1a; padding-top: 6px; text-align: center; font-size: 11px; color: #666; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #999; text-align: center; }
    .obs { background: #f8f9fa; border: 1px solid #ddd; border-radius: 6px; padding: 10px; font-size: 12px; min-height: 40px; margin-bottom: 16px; }
    .badge { display: inline-block; background: #2563EB; color: white; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .print-btn { position: fixed; bottom: 20px; right: 20px; background: #2563EB; color: white; border: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    @media print { .print-btn { display: none; } }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimir PDF</button>

  <div class="header">
    <div>
      <div class="logo">TRANS PLUS</div>
      <div class="logo-sub">Grupo Trans Plus • Mantenimiento de Flota</div>
    </div>
    <div>
      <div class="ot-id">${data.otId}</div>
      <div class="ot-type">ORDEN DE MANTENIMIENTO PREVENTIVO</div>
    </div>
  </div>

  <dl class="info-grid">
    <dt>Fecha</dt><dd>${data.date}</dd>
    <dt>Nivel PM</dt><dd><span class="badge">${data.pmLevel} (${data.levelsIncluded.join(' + ')})</span></dd>
    <dt>Unidad</dt><dd>${data.unidad}</dd>
    <dt>Modelo</dt><dd>${data.model}</dd>
    <dt>Horómetro Actual</dt><dd>${data.horometro.toLocaleString()} hrs</dd>
    <dt>Horas Estimadas</dt><dd>${data.estimatedHours} hrs</dd>
    <dt>Mecánico Asignado</dt><dd>${data.mecanico || 'Por asignar'}</dd>
    <dt>Autorizado Por</dt><dd>${data.autorizadoPor}</dd>
  </dl>

  <h3 style="color:#162252;font-size:14px;margin-bottom:8px">Refacciones Requeridas (${data.parts.length} ítems)</h3>
  <table>
    <thead>
      <tr>
        <th style="width:30px">#</th>
        <th>No. Parte</th>
        <th>Descripción</th>
        <th style="width:40px">Cant.</th>
        <th style="width:40px">Unid.</th>
        <th style="width:60px">Tipo</th>
        <th style="width:50px">Listo</th>
      </tr>
    </thead>
    <tbody>
      ${partsRows}
    </tbody>
  </table>

  <h3 style="color:#162252;font-size:14px;margin-bottom:8px">Observaciones</h3>
  <div class="obs">${data.observaciones || '—'}</div>

  <div class="signatures">
    <div class="sig-box">Coordinador de Mantenimiento</div>
    <div class="sig-box">Mecánico Asignado</div>
    <div class="sig-box">Jefe de Taller</div>
  </div>

  <div class="footer">
    Hermes Fleet App • Grupo Trans Plus • ${data.date} • ${data.otId}
  </div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
