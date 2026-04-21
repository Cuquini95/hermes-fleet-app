/**
 * Admin · Órdenes de Compra
 * Gerencia-only page for creating purchase orders.
 * Writes to Google Sheets tab "Órdenes de Compra". Read by Power-GTP's
 * "Órdenes de Compra" dashboard.
 */

import { useEffect, useState } from 'react';
import { appendRow, readRange } from '../lib/sheets-api';

const TAB = 'Órdenes de Compra';

const HEADERS = [
  'OC_ID', 'FECHA', 'PROVEEDOR', 'UNIDAD', 'DESCRIPCION', 'CANTIDAD',
  'PRECIO_UNITARIO', 'TOTAL', 'GASTO_LINK', 'ESTADO', 'APROBADA_POR', 'FECHA_ENTREGA',
];

interface OCForm {
  oc_id: string;
  fecha: string;
  proveedor: string;
  unidad: string;
  descripcion: string;
  cantidad: string;
  precio_unitario: string;
  estado: 'Borrador' | 'Aprobada' | 'Recibida' | 'Pagada' | 'Rechazada';
  fecha_entrega: string;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toDDMMYYYY(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function nextOcId(rows: string[][] | null): string {
  if (!rows) return 'OC-001';
  let max = 0;
  for (const r of rows) {
    const m = /^OC-(\d+)$/.exec((r[0] ?? '').trim());
    if (m && m[1]) max = Math.max(max, parseInt(m[1], 10));
  }
  return `OC-${String(max + 1).padStart(3, '0')}`;
}

const emptyFor = (oc_id: string): OCForm => ({
  oc_id,
  fecha: todayIso(),
  proveedor: '',
  unidad: 'FLOTA',
  descripcion: '',
  cantidad: '1',
  precio_unitario: '',
  estado: 'Borrador',
  fecha_entrega: '',
});

export default function AdminOrdenesCompraPage() {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<OCForm>(emptyFor('OC-001'));
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoadError(null);
    try {
      const data = await readRange(TAB);
      setRows(data);
      setForm((f) => ({ ...f, oc_id: nextOcId(data) }));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setRows(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const total =
    (parseFloat(form.cantidad) || 0) * (parseFloat(form.precio_unitario) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(null);
    try {
      const row = [
        form.oc_id,
        toDDMMYYYY(form.fecha),
        form.proveedor.trim(),
        form.unidad.trim(),
        form.descripcion.trim(),
        form.cantidad,
        form.precio_unitario.replace(/[^\d.]/g, ''),
        String(total.toFixed(2)),
        '', // GASTO_LINK — assigned when an expense is linked
        form.estado,
        '', // APROBADA_POR — filled on approval
        toDDMMYYYY(form.fecha_entrega),
      ];
      await appendRow(TAB, row);
      setSuccess(`OC ${form.oc_id} registrada en Google Sheets.`);
      await load();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const tabMissing =
    loadError !== null &&
    /Unable to parse range|not found|404|500|Internal server/i.test(loadError);

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Órdenes de Compra</h1>
      <p className="text-sm text-gray-600 mb-6">
        Crea órdenes de compra para el dashboard de{' '}
        <strong>Órdenes de Compra</strong> en Power-GTP. Se escribe en la
        pestaña <code>Órdenes de Compra</code> del Google Sheet de Hermes.
      </p>

      {tabMissing && (
        <div className="mb-6 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
          <p className="font-bold text-amber-900 mb-2">
            ⚠ La pestaña "Órdenes de Compra" no existe todavía
          </p>
          <p className="text-sm text-amber-900 mb-2">
            Crea una pestaña nueva en el Google Sheet de Hermes llamada{' '}
            <code className="bg-white px-1 rounded">Órdenes de Compra</code> y
            pega esta fila de encabezados en la primera línea:
          </p>
          <code className="block text-xs bg-white border rounded p-2 overflow-x-auto">
            {HEADERS.join(' | ')}
          </code>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 text-green-800 px-3 py-2 text-sm">
          {success}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border shadow-sm p-4 grid grid-cols-2 gap-3 mb-6"
      >
        <Input label="OC ID" value={form.oc_id} onChange={(v) => setForm({ ...form, oc_id: v })} required />
        <Input label="Fecha" type="date" value={form.fecha} onChange={(v) => setForm({ ...form, fecha: v })} required />
        <Input label="Proveedor" value={form.proveedor} onChange={(v) => setForm({ ...form, proveedor: v })} required />
        <Input label="Unidad (o FLOTA)" value={form.unidad} onChange={(v) => setForm({ ...form, unidad: v })} />
        <div className="col-span-2">
          <Input label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} required />
        </div>
        <Input label="Cantidad" type="number" value={form.cantidad} onChange={(v) => setForm({ ...form, cantidad: v })} required />
        <Input label="Precio unitario (MXN)" type="number" value={form.precio_unitario} onChange={(v) => setForm({ ...form, precio_unitario: v })} required />
        <div className="col-span-2 text-sm text-gray-700">
          <strong>Total:</strong> ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
        </div>
        <Select label="Estado" value={form.estado} options={['Borrador', 'Aprobada', 'Recibida', 'Pagada', 'Rechazada']} onChange={(v) => setForm({ ...form, estado: v as OCForm['estado'] })} />
        <Input label="Fecha entrega (opcional)" type="date" value={form.fecha_entrega} onChange={(v) => setForm({ ...form, fecha_entrega: v })} />

        <div className="col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 text-white font-semibold py-2.5 hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : 'Crear OC'}
          </button>
        </div>
      </form>

      <h2 className="text-lg font-semibold mb-2">Órdenes registradas</h2>
      {rows === null && !tabMissing && (
        <p className="text-sm text-gray-500">Cargando…</p>
      )}
      {rows !== null && rows.length <= 1 && (
        <p className="text-sm text-gray-500">
          Sin órdenes todavía. Crea la primera arriba.
        </p>
      )}
      {rows !== null && rows.length > 1 && (
        <div className="overflow-x-auto bg-white border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {HEADERS.map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.slice(1).map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {HEADERS.map((_, j) => (
                    <td key={j} className="px-2 py-1">{r[j] ?? ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Small inline form controls ─────────────────────────────────────────────

interface InputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}
function Input({ label, value, onChange, type = 'text', required }: InputProps) {
  return (
    <label className="flex flex-col text-xs text-gray-700">
      <span className="font-semibold mb-0.5">{label}{required && ' *'}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded px-2 py-1.5 text-sm"
      />
    </label>
  );
}

interface SelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}
function Select({ label, value, options, onChange }: SelectProps) {
  return (
    <label className="flex flex-col text-xs text-gray-700">
      <span className="font-semibold mb-0.5">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded px-2 py-1.5 text-sm bg-white"
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
