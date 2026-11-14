import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import PanamaWorkshopSummary from './PanamaWorkshopSummary';

test('la tarjeta muestra la discrepancia y el corte de cada fuente', () => {
  const html = renderToStaticMarkup(<PanamaWorkshopSummary loading={false} data={{
    alertsToday: 1, openOrders: 1, criticalOTs: null,
    failures: {
      masterAvailable: true, operationalAvailable: true, capturedAt: '2026-11-14T13:21:18Z',
      records: [{ source: 'master', id: 'TMF-QA-42', unit: 'DZ203', status: 'Cerrada',
        needsReview: true, operationalStatus: 'En Reparación' }],
    },
    orders: { masterAvailable: true, operationalAvailable: true, capturedAt: null, records: [] },
  }} />);
  expect(html).toContain('Averías hoy: 1');
  expect(html).toContain('OTs abiertas: 1');
  expect(html).toContain('OTs críticas: Sin verificar');
  expect(html).toContain('TMF-QA-42 · DZ203');
  expect(html).toContain('Maestro: Cerrada');
  expect(html).toContain('Hermes: En Reparación');
  expect(html).toContain('Por conciliar');
  expect(html).toContain('Averías · corte');
});
