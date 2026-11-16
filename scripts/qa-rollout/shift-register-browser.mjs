import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { loadAccounts } from './fixture.mjs';

const lastAccount = role => loadAccounts.findLast(account => account.membership.role === role);
const cut = {
  capturedAt: '2026-10-11T14:05:00.000Z',
  records: [
    { unit: 'EX401', id: 'REG-QA-PARTE-08', date: '08-Oct-2026', shift: 'Dia', start: '1,010.000', end: '1,018.000' },
    { unit: 'EX401', id: 'REG-QA-PARTE-09', date: '09-Oct-2026', shift: 'Día', start: '1,020.000', end: '1,027.500' },
    { unit: 'DZ205', id: 'REG-QA-OTRA-UNIDAD', date: '10-Oct-2026', shift: 'Día', start: '1030', end: '1038' },
  ],
};
const cases = [
  { day: '08', initialHours: '1010', finalHours: '1018', official: '8 h del turno en REGISTRO', delta: '0 h de diferencia',
    status: 'Coincide con el corte de REGISTRO · REG-QA-PARTE-08' },
  { day: '09', initialHours: '1020', finalHours: '1028', official: '7.5 h del turno en REGISTRO', delta: '-0.5 h de diferencia',
    status: 'Lecturas distintas en REGISTRO. Requiere revisión. · REG-QA-PARTE-09' },
  { day: '10', initialHours: '1030', finalHours: '1038', official: 'Horas no disponibles', delta: 'Pendiente de conciliación',
    status: 'Sin coincidencia en el corte de REGISTRO' },
];

export async function checkShiftRegister({ fixture, inRole, noHorizontalOverflow, shot,
  operatorAccount = lastAccount('operador'), supervisorAccount = lastAccount('supervisor') }) {
  const { origin, sheet } = fixture;
  const tab = 'HERMES_PA_TURNOS';
  const previous = sheet.read(tab);
  const restoreCut = fixture.setOfficialShiftCut(cut);
  const part = (page, id) => page.getByRole('article').filter({ hasText: id });

  async function verifyAfterReload(page, folios, width) {
    await page.reload({ waitUntil: 'domcontentloaded' });
    for (const [index, id] of folios.entries()) {
      const { official, delta, status } = cases[index];
      const card = part(page, id);
      await card.getByText(`${id} · Aceptado por Supervisión`, { exact: true }).waitFor();
      const comparison = card.getByRole('region', { name: 'Conciliación con REGISTRO' });
      for (const value of [status, '8 h del turno', official, delta, 'Corte de REGISTRO · 11 oct 2026, 9:05 · Panamá']) {
        await comparison.getByText(value, { exact: true }).waitFor();
      }
      assert.equal(await comparison.locator('time').getAttribute('datetime'), cut.capturedAt);
    }
    await noHorizontalOverflow(page, width);
    await part(page, folios[1]).getByRole('region', { name: 'Conciliación con REGISTRO' }).scrollIntoViewIfNeeded();
    await shot(page, `relevo-registro-${width}.png`);
  }

  try {
    const folios = await inRole('operador', 360, async page => {
      const result = [];
      for (const { day, initialHours, finalHours } of cases) {
        const response = await page.request.post(`${origin}/hermes-api/api/panama/turnos/entregar`, {
          data: { unit: 'EX401', date: `2026-10-${day}`, shift: 'Día', initialHours, finalHours,
            equipmentStatus: 'Operativo', support: `Parte QA REGISTRO ${day}`, trips: '0', tonnes: '0',
            stops: 'Sin paradas', client: 'Cliente sintético TMF', mutationId: randomUUID(),
            expectedUserId: operatorAccount.user.id },
        });
        assert.equal(response.status(), 201, await response.text());
        result.push((await response.json()).record.id);
      }
      return result;
    }, operatorAccount);

    await inRole('supervisor', 390, async page => {
      await page.goto(`${origin}/panama/turnos`, { waitUntil: 'domcontentloaded' });
      for (const id of folios) {
        const card = part(page, id);
        const accepted = page.waitForResponse(response => response.url().endsWith('/api/panama/turnos/revisar') && response.request().method() === 'POST');
        await card.getByRole('button', { name: 'Aceptar parte', exact: true }).click();
        assert.equal((await accepted).status(), 200);
        await card.getByRole('region', { name: 'Conciliación con REGISTRO' }).waitFor();
        await page.getByRole('button', { name: 'Actualizar', exact: true }).waitFor();
      }
      await verifyAfterReload(page, folios, 390);
    }, supervisorAccount);

    await inRole('operador', 360, async page => {
      await page.goto(`${origin}/panama/turnos`, { waitUntil: 'domcontentloaded' });
      await verifyAfterReload(page, folios, 360);
    }, operatorAccount);

    assert.equal(sheet.read(tab).filter(row => folios.includes(row[0]) && row[20] === 'accept').length, 3);
    return { folios, roles: ['operador', 'supervisor'], reload: true, cut: cut.capturedAt,
      registerHours: [8, 7.5, null], partHours: [8, 8, 8], differenceHours: [0, -0.5, null], widths: [360, 390] };
  } finally {
    restoreCut();
    sheet.seed(tab, previous);
  }
}
