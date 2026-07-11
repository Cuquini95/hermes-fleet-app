import { colorLabel } from './sticker-inspection';
import type { StickerColor } from '../types/sticker-inspection';

interface StickerPrintRecord {
  folio: string;
  color: StickerColor;
  unitId: string;
  company: string;
  inspectionDate: string;
  expiryDate: string;
  inspector: string;
  supervisor: string;
  qrText: string;
  findingsSummary: string;
}

const COLOR_HEX: Record<StickerColor, string> = {
  green: '#16a34a',
  yellow: '#eab308',
  red: '#dc2626',
};

export function printSticker(record: StickerPrintRecord): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const status = colorLabel(record.color).toUpperCase();
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Sticker ${record.folio}</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f3f4f6; color: #111827; }
    .sheet { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .sticker {
      width: 420px; height: 420px; border-radius: 999px; background: ${COLOR_HEX[record.color]};
      color: white; border: 10px solid white; box-shadow: 0 16px 40px rgba(0,0,0,.18);
      display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
      padding: 36px; box-sizing: border-box;
    }
    .arc { font-size: 24px; letter-spacing: 2px; font-weight: 800; margin-bottom: 12px; }
    .folio { background: white; color: #111827; padding: 7px 16px; border-radius: 8px; font-weight: 800; margin-bottom: 10px; }
    .status { background: white; color: #111827; padding: 10px 22px; border-radius: 8px; font-size: 34px; font-weight: 900; margin: 8px 0 14px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; width: 100%; font-size: 14px; text-align: left; }
    .field { background: rgba(255,255,255,.95); color: #111827; border-radius: 6px; padding: 6px 8px; min-height: 18px; }
    .label { font-size: 11px; opacity: .9; text-transform: uppercase; }
    .notes { margin-top: 12px; font-size: 12px; max-width: 310px; line-height: 1.35; }
    .qr { margin-top: 8px; background: white; color: #111827; border-radius: 8px; padding: 8px 10px; font-size: 10px; max-width: 280px; word-break: break-all; }
    .print-btn { position: fixed; right: 20px; bottom: 20px; border: 0; border-radius: 8px; background: #111827; color: white; padding: 12px 18px; font-weight: 700; }
    @media print {
      body { background: white; }
      .sheet { padding: 0; }
      .print-btn { display: none; }
      .sticker { box-shadow: none; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <main class="sheet">
    <section class="sticker">
      <div class="arc">INSPECCION DE MAQUINARIA</div>
      <div class="folio">Folio: ${escapeHtml(record.folio)}</div>
      <div class="status">${status}</div>
      <div class="grid">
        <div><div class="label">Empresa</div><div class="field">${escapeHtml(record.company)}</div></div>
        <div><div class="label">No. economico</div><div class="field">${escapeHtml(record.unitId)}</div></div>
        <div><div class="label">Inspeccion</div><div class="field">${escapeHtml(record.inspectionDate)}</div></div>
        <div><div class="label">Vigencia</div><div class="field">${escapeHtml(record.expiryDate)}</div></div>
        <div><div class="label">Inspector</div><div class="field">${escapeHtml(record.inspector)}</div></div>
        <div><div class="label">Supervisor</div><div class="field">${escapeHtml(record.supervisor || 'Pendiente')}</div></div>
      </div>
      <div class="notes">${escapeHtml(record.findingsSummary)}</div>
      <div class="qr">${escapeHtml(record.qrText)}</div>
    </section>
  </main>
  <button class="print-btn" onclick="window.print()">Imprimir / guardar PDF</button>
</body>
</html>`;

  printWindow.document.write(html);
  printWindow.document.close();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
