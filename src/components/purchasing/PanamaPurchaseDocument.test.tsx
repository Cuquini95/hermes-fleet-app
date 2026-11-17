import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import type { PurchaseOrder } from '../../lib/purchasing-api';
import PanamaPurchaseDocument from './PanamaPurchaseDocument';

const order: PurchaseOrder = {
  folio: 'OC-PRUEBA',
  number: '3010',
  date: '2026-11-12',
  deliveryDate: '2026-11-14',
  vendorName: 'Proveedor de prueba',
  vendorRfc: '',
  vendorAddress: '',
  unit: 'DZ203',
  subtotal: '25.00',
  tax: '1.75',
  shipping: '0.00',
  other: '0.00',
  total: '26.75',
  status: 'Aprobada',
  receiptStatus: 'Pendiente',
  comments: '',
  issuer: { id: 'TP_QA', name: 'Trans Plus Panamá', address: '', phone: '', currency: 'USD', taxLabel: 'ITBMS', template: 'transplus' },
  approvedBy: 'Gerencia de prueba',
  approvedById: 'gerencia-prueba',
  approvedAt: '2026-11-16T17:46:00Z',
  requestedBy: 'Solicitante de prueba',
  version: '1',
  lines: [],
};

function printedOrder(approvalSignature?: string) {
  return renderToStaticMarkup(<PanamaPurchaseDocument order={order} authorized
    approvedAt="16 nov 2026, 12:46 p.m." approvalSignature={approvalSignature} dateLabel={value => value} />);
}

it('conserva el logo de la plantilla de Trans Plus y ubica la firma registrada en el espacio de aprobación', () => {
  const html = printedOrder('firma-de-prueba');

  expect(html).toContain('src="/logo-transplus-oc.png"');
  expect(html).toMatch(/<div class="po-panama-signature"><p>Firma autorizada<\/p><\/div>/);
  expect(html).toMatch(/<div class="po-panama-signature"><img [^>]*alt="Firma de Gerencia de prueba"[^>]*\/><p>Firma aprueba<\/p><\/div>/);
  expect(html).toContain('Autorización digital registrada');
  expect(html).toContain('16 nov 2026, 12:46 p.m. · OC 3010');
});

it('conserva ambos espacios y avisa cuando existe aprobación sin firma archivada', () => {
  const html = printedOrder();

  expect(html).toContain('Firma autorizada');
  expect(html).toContain('Firma aprueba');
  expect(html).toContain('Firma pendiente');
  expect(html).toContain('Autorización digital registrada');
  expect(html).not.toContain('data:image/png');
});
