import { identityConfig, identityRequest } from './hermes-identity.js';
import { canonicalTab } from './hermes-google-sheets.js';

const route = '/rest/v1/hermes_preview_operations';
const workspace = 'panama-demo';
const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Panama', day: '2-digit', month: '2-digit', year: 'numeric' });
export const PANAMA_DEMO_ISSUER = Object.freeze({ id: 'TP_PA_DEMO', name: 'Trans Plus Panamá · Prueba', currency: 'USD',
  taxLabel: 'ITBMS', taxBps: 700, template: 'transplus', address: 'Panamá · Dirección simulada', phone: '', taxId: 'RUC-DEMO' });

function initialData() {
  const today = date.format(new Date());
  const equipment = [
    ['1', 'QA-DZ203', 'Tractor de prueba', 'Komatsu', 'D65EX-16', '2020', 'SERIE-QA-01', 'Frente de prueba', 'En Taller', '1475'],
    ['2', 'QA-EX401', 'Excavadora de prueba', 'Doosan', 'DX360LC-7', '2021', 'SERIE-QA-02', 'Frente de prueba', 'Operativo', '1960'],
    ['3', 'QA-DZ205', 'Volteo de prueba', 'Mack', 'Granite', '2022', 'SERIE-QA-03', 'Frente de prueba', 'Operativo', '390'],
  ];
  const tables = Object.fromEntries([
    'OT_STATUS_LOG', '14 Inspecciones', 'Inspeccion_Stickers', 'Inspeccion_Hallazgos', '04B Registro Horómetros',
    '05 Historial PM', 'Ordenes Mantenimiento', 'WORKSHOP_SCHEDULE', 'Reporte_Fletes_Transporte', 'Reporte_Viajes_Peña',
    'Incidentes', 'Turnos', '13 Neumáticos', '02 Gastos', '10 Control Cambios', 'Activos', 'HERMES_PA_TURNOS', 'HERMES_PA_DESPACHO',
  ].map(tab => [tab, []]));
  Object.assign(tables, {
    '01 Inventario': [['Inventario de prueba'], ['TMF Panamá · Datos simulados'],
      ['#', 'COD1', 'Descripción', 'Marca', 'Modelo', 'Año', 'Serie', 'Ubicación', 'Estado', 'Lectura Hr/Km'], ...equipment],
    'Averías': [['FECHA', 'HORA', 'UNIDAD'], [today, '07:20:00', 'QA-DZ203', 'Hidráulica', 'Fuga hidráulica simulada', 'CRITICA', 'Operador QA', '', '', 'Abierta', '', '', '', 'OT-DEMO-001']],
    ORDENES_TRABAJO: [['ROW_ID', 'OT_ID', 'FECHA', 'UNIDAD'],
      ['demo-initial', 'OT-DEMO-001', today, 'QA-DZ203', 'Hidráulica', 'Fuga hidráulica simulada', 'CRITICA', 'CRITICA', '', 'Abierta', '', 'OT-DEMO-001', '', '', '', '', '0']],
    Combustible: [['ID', 'FECHA', 'HORA', 'UNIDAD', 'OPERADOR', 'TIPO', 'LITROS'],
      ['FUEL-DEMO-001', today, '07:00:00', 'QA-EX401', 'Operador QA', 'Diésel', '120'],
      ['FUEL-DEMO-002', today, '07:15:00', 'QA-DZ205', 'Operador QA', 'Diésel', '180']],
    '12 Inventario Rep.': [[], [], [], [], ['SKU', 'Descripción', 'OEM', 'Serie', 'Unidad', 'Stock', 'Mínimo', 'Precio', 'Ubicación', '', 'Equipo', '', '', 'Proveedor'],
      ['QA-FILTRO-001', 'Filtro hidráulico de prueba', 'OEM-QA-001', '', 'pza', '8', '3', '75', 'Almacén de prueba', '', 'QA-DZ203', '', '', 'Proveedor de prueba']],
    Cotizaciones_Pendientes: [['FECHA', 'PART_NUMBER', 'DESCRIPCION', 'EQUIPO', 'CANTIDAD']],
    Proveedores: [['Nombre', 'Identificación', 'Dirección', 'Ciudad', 'Estado', 'CP', 'Teléfono', 'Email', 'Contacto'],
      ['Proveedor de prueba', 'RUC-QA-001', 'Almacén de prueba', 'Panamá', '', '', '', '', '']],
    'Órdenes de Compra': [['OC_ID', 'FECHA', 'PROVEEDOR', 'IDENTIFICACION', 'DIRECCION', 'UNIDAD'],
      ['OC-DEMO-001', today, 'Proveedor de prueba', 'RUC-QA-001', 'Panamá', 'QA-DZ203', '150.00', '10.50', '0.00', '0.00', '160.50',
        'Aprobada', 'Compra simulada', 'Gerencia QA', today, 'demo-oc-001', JSON.stringify(PANAMA_DEMO_ISSUER),
        '00000000-0000-4000-8000-000000000001', new Date().toISOString()]],
    OC_Lineas: [['OC_ID', 'ITEM', 'DESCRIPCION', 'CANTIDAD', 'PRECIO_UNITARIO', 'TOTAL'],
      ['OC-DEMO-001', '1', 'Filtro hidráulico de prueba', '2', '75.00', '150.00', 'OC-DEMO-001-L1', '', '', 'QA-FILTRO-001', '0', '[]']],
  });
  // The operational readers skip these headers when projecting records.
  tables['02 Gastos'] = [['ID', 'FECHA', 'HORA', 'TIPO', 'PROVEEDOR', 'RFC', 'FOLIO_FACTURA', 'SUBTOTAL', 'IVA', 'TOTAL', 'UNIDAD']];
  return { tables, receipts: {}, guards: {} };
}

const fail = (status, message) => Object.assign(new Error(message), { status });
const properties = { workspace: `eq.${workspace}`, select: 'revision,data', limit: '1' };

export function createPanamaDemoSheets(request = options => identityRequest(identityConfig(), route, options)) {
  async function load() {
    const response = await request({ query: properties });
    if (!response.ok) throw fail(503, 'Fuente de prueba no disponible');
    const [row] = await response.json();
    return row ?? { revision: null, data: initialData() };
  }

  function receipt(data, key, fingerprint) {
    const prior = Object.hasOwn(data.receipts, key) && data.receipts[key];
    if (!prior) return null;
    if (prior.fingerprint !== fingerprint) throw fail(409, 'La operación ya existe con otros datos.');
    return prior.result;
  }

  function write(tables, change) {
    const tab = canonicalTab(change.tab);
    if (!Object.hasOwn(tables, tab) && tab === 'Movimientos Repuestos PA') {
      tables[tab] = [['ID', 'FECHA_UTC', 'TIPO', 'SKU', 'CANTIDAD', 'UNIDAD', 'OC', 'PARTIDA', 'OT', 'REFERENCIA', 'ACTOR', 'ACTOR_ID', 'EXISTENCIA', 'MEDIDA']];
    }
    if (tab === 'HERMES_PA_DESPACHO' && !Object.hasOwn(tables, tab)) tables[tab] = [];
    if (!Object.hasOwn(tables, tab)) throw fail(503, 'La tabla de prueba no está disponible.');
    if (change.append) {
      tables[tab].push(...change.append);
      return;
    }
    if (!tables[tab][change.row]) throw fail(409, 'El registro cambió. Actualiza la pantalla.');
    const row = tables[tab][change.row];
    change.values.forEach((value, index) => { row[(change.col ?? 0) + index] = value; });
  }

  async function commit({ key, fingerprint, guard, guards = [], writes, result }) {
    const keys = [guard, ...guards].filter(Boolean);
    for (let attempt = 0; attempt < 5; attempt++) {
      const { revision, data } = await load();
      const prior = receipt(data, key, fingerprint);
      if (prior !== null) return { result: prior, replayed: true };
      if (keys.some(value => Object.hasOwn(data.guards, value))) throw fail(409, 'El registro cambió. Actualiza la pantalla.');
      for (const change of writes) write(data.tables, change);
      for (const value of keys) data.guards[value] = true;
      data.receipts[key] = { fingerprint, result };
      const options = revision === null
        ? { method: 'POST', body: { workspace, revision: 1, data }, prefer: 'resolution=ignore-duplicates,return=representation' }
        : { method: 'PATCH', query: { workspace: properties.workspace, revision: `eq.${revision}` },
          body: { revision: revision + 1, data }, prefer: 'return=representation' };
      const response = await request(options);
      if (!response.ok) throw fail(503, 'No se pudo confirmar el guardado de prueba.');
      if ((await response.json()).length === 1) return { result, replayed: false };
    }
    throw fail(409, 'Hubo cambios simultáneos. Reintenta la operación.');
  }

  async function read(tab) {
    const { data } = await load();
    const rows = data.tables[canonicalTab(tab)] ?? [];
    return rows.map(row => Array.from(row, value => String(value ?? '')));
  }

  async function readSummary(spec) {
    const { data: { tables } } = await load();
    const sources = {
      fleet: () => tables['01 Inventario'].slice(3).map(row => [row[1], row[2], row[4], row[2], 'Sí']),
      failures: () => tables.Averías.slice(1).map(row => [row[13], row[2], row[4], row[9], row[0], row[13]]),
      orders: () => tables.ORDENES_TRABAJO.slice(1).map(row => [row[1], row[3], row[5], row[9], 'Simulada']),
    };
    const header = [...Object.values(spec.columns), ...(spec.country ? [spec.country] : [])];
    return [header, ...(sources[spec.key]?.() ?? [])];
  }

  return { read, readSummary, commit, replay: async ({ key, fingerprint }) => receipt((await load()).data, key, fingerprint) };
}
