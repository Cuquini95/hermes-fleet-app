import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { PanamaWorkshopExceptions } from './PanamaWorkshopExceptions';

it('muestra el folio que abre la OT de origen, los campos confirmados y las confirmaciones pendientes', () => {
  const html = renderToStaticMarkup(<MemoryRouter>
    <PanamaWorkshopExceptions loading={false} unavailable refresh={async () => {}}
      view={{ observedAt: '2026-11-16T02:00:00Z', unconfirmed: false, alerts: [
        {
          id: 'OT-EXCEPTION-QA', unit: 'DZ203', state: 'active', kind: 'critical', folio: 'OT-0892',
          owner: 'Mecánico QA', status: 'En Reparación', description: '', dueHours: 1500, pendingConfirmation: true,
        },
        {
          id: 'OT-RETURN-QA', unit: 'DZ205', state: 'active', kind: 'return', folio: 'OT-0893',
          owner: null, status: 'Completado', description: '', dueHours: null, pendingConfirmation: false,
        },
      ] }} />
  </MemoryRouter>);

  expect(html).toContain('href="/workorders/OT-EXCEPTION-QA"');
  expect(html).toContain('OT-0892');
  expect(html).toContain('Mecánico QA');
  expect(html).toMatch(/1[.,]?500 h de horómetro/);
  expect(html).toContain('Operaciones · persona sin confirmar');
  expect(html).toContain('Estado sin confirmar en la última consulta.');
  expect(html).toContain('Consulta sin confirmar. Se conservan los avisos previos.');
  expect(html).not.toContain('Sin excepciones activas');
});
