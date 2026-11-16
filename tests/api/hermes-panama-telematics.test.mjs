import test from 'node:test';
import assert from 'node:assert/strict';
import { createHermesGateway } from '../../api/hermes-sheets-gate.js';

const now = Date.parse('2026-11-14T18:00:00Z');
const policy = {
  sources: [{ key: 'qa-source', label: 'Telemática QA', maxAgeHours: 24, units: { DZ203: ['h'], CV20: ['km'] } }],
  odometerUnits: ['CV20'],
};
const sample = (unit, measure, value, measuredAt, fields = {}) => ({
  project: 'tmf-panama', source: 'qa-source', unit, measure, value, measuredAt, reference: 'Respaldo QA', ...fields,
});
const rows = new Map([
  ['01 Inventario', [[], [], [], ['', 'DZ203'], ['', 'CV20']]],
  ['04B Registro Horómetros', [
    ['2026-11-14', '10:00', 'DZ203', '', '', 'inicio', '390'],
    ['2026-10-31', '21:00', 'DZ203', '', '', 'final', '380'],
  ]],
  ['HERMES_PA_ODOMETRO', [
    ['UNIDAD', 'MEDIDO_EN', 'KILOMETROS', 'REFERENCIA', 'REGISTRADO_EN', 'AUTOR_ID'],
    ['CV20', '2026-11-14T16:30:00.000Z', '200', 'Foto odómetro QA', '2026-11-14T17:00:00.000Z', 'user-qa'],
  ]],
]);
const session = { project: 'tmf-panama', role: 'operador', userId: 'user-qa', userName: 'Operador QA', assignedUnits: ['CV20', 'DZ203'] };
const fixture = ({ cut, config = policy, identity = session, failTab } = {}) => {
  const state = structuredClone(rows);
  const receipts = new Map();
  let reads = 0;
  const sheets = {
    read: async tab => {
      if (tab === failTab) throw new Error('QA: registro caído');
      return structuredClone(state.get(tab) ?? []);
    },
    replay: async ({ key, fingerprint }) => {
      const previous = receipts.get(key);
      if (previous && previous.fingerprint !== fingerprint) throw Object.assign(new Error('Operación repetida con otros datos.'), { status: 409 });
      return previous?.result ?? null;
    },
    commit: async ({ key, fingerprint, writes, result }) => {
      for (const write of writes) state.get(write.tab).push(...write.append);
      receipts.set(key, { fingerprint, result });
      return { result };
    },
  };
  const gate = createHermesGateway({
    enablePanamaOperations: true, writeEnabled: true,
    sessionReader: async () => identity, panamaTelematicsConfig: () => config,
    readTelematicsCut: async () => {
      reads++;
      if (cut instanceof Error) throw cut;
      return { capturedAt: '2026-11-14T17:50:00Z', readings: cut ?? [] };
    },
    meterClock: () => now,
    sheets, demoSheets: { read: async tab => tab === '04B Registro Horómetros' ? [] : assert.fail('La demo no lee fuentes del piloto.') },
    readOfficialShifts: async () => ({ capturedAt: '2026-11-14T17:00:00Z', records: [
      { unit: 'DZ203', id: 'TMF-QA-01', date: '14-Nov-2026', shift: 'Día', start: '390', end: '397' },
    ] }),
  });
  return {
    reads: () => reads, state,
    async request(unit, { period, body } = {}) {
      const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
      await gate({ method: body ? 'POST' : 'GET', body,
        query: { path: 'api/panama/horometros', unit, ...(period && { period }) } }, res);
      return res;
    },
  };
};

test('unifica horas y kilómetros según alcance, origen, vigencia y mes de Panamá', async () => {
  const f = fixture({ cut: [
    sample('DZ203', 'min', '23940', '2026-11-14T17:10:00Z'),
    sample('DZ203', 'km', 900, '2026-11-14T17:15:00Z'),
    sample('DZ203', 'h', 700, '2026-11-14T17:20:00Z', { project: 'mexico' }),
    sample('DZ203', 'h', 800, '2026-11-14T17:25:00Z', { source: 'unknown' }),
    sample('DZ203', 'h', 380, '2026-11-01T03:00:00Z'),
    sample('CV20', 'mi', 100, '2026-11-13T17:00:00Z'),
    sample('CV20', 'km', 900, '2026-11-15T00:00:00Z'),
  ] });
  const current = await f.request('DZ203');
  assert.equal(current.statusCode, 200);
  const { meters } = current.body;
  assert.equal(meters.status, 'available');
  assert.equal(meters.period, '2026-11');
  assert.deepEqual(meters.streams.map(({ measure, primary, automatic }) => [measure, primary, automatic.value, automatic.originalMeasure]), [['h', 'telematics', 399, 'min']]);
  assert.deepEqual(new Set(meters.readings.map(r => r.origin)), new Set(['telematics', 'manual', 'register']));
  assert.equal(meters.readings.find(r => r.reference === 'TMF-QA-01')?.source, 'REGISTRO TMF');
  const past = await f.request('DZ203', { period: '2026-10' });
  assert.equal(past.body.meters.readings.filter(r => r.origin === 'telematics').length, 1);
  assert.equal(past.body.meters.readings.find(r => r.origin === 'telematics').period, '2026-10');
  assert.equal(past.body.meters.streams[0].automatic.value, 399);
  const truck = (await f.request('CV20')).body.meters;
  const km = truck.streams.find(s => s.measure === 'km');
  assert.equal(km.primary, 'manual');
  assert.equal(km.automatic.value, 160.934);
  assert.equal(km.automatic.freshness, 'stale');
  assert.equal(km.manual.value, 200);
  assert.equal(km.manual.reference, 'Foto odómetro QA');
  assert.equal(truck.canCaptureDistance, true);
  assert.equal((await f.request('OTRA')).statusCode, 403);
  assert.equal((await f.request('DZ203', { period: '2026-13' })).statusCode, 400);
});

test('si el corte no está disponible conserva Hermes y el REGISTRO; una sesión demo omite el corte real', async () => {
  const f = fixture({ cut: new Error('QA: fuente caída') });
  const meter = (await f.request('DZ203')).body.meters;
  assert.equal(meter.status, 'unavailable');
  assert.equal(meter.streams[0].primary, 'manual');
  assert.equal(meter.streams[0].manual.value, 390);
  assert.equal(meter.streams[0].register.value, 397);
  const absent = fixture({ config: null });
  const unconfigured = (await absent.request('DZ203')).body.meters;
  assert.equal(unconfigured.status, 'not_configured');
  assert.equal(absent.reads(), 0);
  const demo = fixture({ identity: { ...session, previewDemo: true } });
  const demoMeter = (await demo.request('DZ203')).body.meters;
  assert.equal(demoMeter.status, 'not_configured');
  assert.equal(demoMeter.readings.length, 0);
  assert.equal(demo.reads(), 0);
});

test('excluye duplicados contradictorios y mantiene la consulta si falta el registro manual', async () => {
  const f = fixture({ failTab: '04B Registro Horómetros', cut: [
    sample('DZ203', 'h', 397, '2026-11-14T17:10:00Z'),
    sample('DZ203', 'h', 399, '2026-11-14T17:10:00Z'),
    sample('DZ203', 'h', 700, '2026-02-30T17:20:00Z'),
    sample('DZ203', 'h', 398, '2026-11-14T17:05:00Z'),
  ] });
  const result = await f.request('DZ203');
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.meters.conflicts, 1);
  assert.equal(result.body.meters.manualHoursAvailable, false);
  assert.equal(result.body.meters.streams[0].automatic.value, 398);
  assert.equal(result.body.canReplace, false);
});

test('el odómetro manual admite respaldo e idempotencia y se mantiene fuera de las horas', async () => {
  const f = fixture();
  const reading = { action: 'odometer', unit: 'CV20', date: '2026-11-14', time: '11:45', value: '210.125',
    reference: 'Foto tablero 1411', mutationId: '994ddc2e-b1e8-4bcc-a93c-8b6f778d7ad2', expectedUserId: 'user-qa' };
  assert.equal((await f.request('CV20', { body: { ...reading, unit: 'DZ203' } })).statusCode, 403);
  assert.equal((await f.request('CV20', { body: { ...reading, reference: ' ' } })).statusCode, 400);
  assert.equal((await f.request('CV20', { body: { ...reading, value: '190' } })).statusCode, 409);
  assert.equal((await f.request('CV20', { body: reading })).statusCode, 201);
  assert.equal((await f.request('CV20', { body: reading })).statusCode, 200);
  assert.equal((await f.request('CV20', { body: { ...reading, value: '212' } })).statusCode, 409);
  const result = await f.request('CV20');
  assert.equal(result.body.meters.streams.find(s => s.measure === 'km').manual.value, 210.125);
  assert.equal(result.body.history.length, 0);
  assert.equal(f.state.get('HERMES_PA_ODOMETRO').length, 3);
  assert.equal(f.state.get('04B Registro Horómetros').length, 2);
});
