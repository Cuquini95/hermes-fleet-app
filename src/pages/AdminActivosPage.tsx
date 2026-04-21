/**
 * Admin · Activos
 * Gerencia-only page for creating fleet asset records.
 * Writes to Google Sheets tab "Activos". Read by Power-GTP's
 * "Ciclo de Vida de Activos" dashboard.
 */

import { useEffect, useState } from 'react';
import { appendRow, readRange } from '../lib/sheets-api';

const TAB = 'Activos';

const HEADERS = [
  'UNIDAD', 'MODELO', 'MARCA', 'AÑO', 'FECHA_ADQUISICION',
  'COSTO_ADQUISICION', 'VIDA_UTIL_ANOS', 'VALOR_RESIDUAL', 'METODO',
  'HORAS_TOTALES_VIDA', 'SEGMENTO', 'NOTAS',
];

interface AssetForm {
  unidad: string;
  modelo: string;
  marca: string;
  ano: string;
  fecha_adquisicion: string;
  costo_adquisicion: string;
  vida_util_anos: string;
  valor_residual: string;
  metodo: 'Lineal' | 'Saldo Decreciente';
  horas_totales_vida: string;
  segmento: 'Renta' | 'Transporte' | 'Ambos';
  notas: string;
}

const empty: AssetForm = {
  unidad: '', modelo: '', marca: '', ano: String(new Date().getFullYear()),
  fecha_adquisicion: '', costo_adquisicion: '', vida_util_anos: '10',
  valor_residual: '0', metodo: 'Lineal', horas_totales_vida: '20000',
  segmento: 'Transporte', notas: '',
};

function toDDMMYYYY(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export default function AdminActivosPage() {
  const [rows, setRows] = useState<string[][] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<AssetForm>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setLoadError(null);
    try {
      const data = await readRange(TAB);
      setRows(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err));
      setRows(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSuccess(null);
    try {
      const row = [
        form.unidad.trim(),
        form.modelo.trim(),
        form.marca.trim(),
        form.ano.trim(),
        toDDMMYYYY(form.fecha_adquisicion),
        form.costo_adquisicion.replace(/[^\d.]/g, ''),
        form.vida_util_anos,
        form.valor_residual.replace(/[^\d.]/g, ''),
        form.metodo,
        form.horas_totales_vida,
        form.segmento,
        form.notas.trim(),
      ];
      await appendRow(TAB, row);
      setSuccess(`Activo ${form.unidad} registrado en Google Sheets.`);
      setForm(empty);
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
      <h1 className="text-2xl font-bold mb-1">Activos</h1>
      <p className="text-sm text-gray-600 mb-6">
        Registra la flota para el dashboard de <strong>Ciclo de Vida de Activos</strong>{' '}
        en Power-GTP. Se escribe en la pestaña <code>Activos</code> del Google
        Sheet de Hermes.
      </p>

      {tabMissing && (
        <div className="mb-6 rounded-lg border-2 border-amber-300 bg-amber-50 p-4">
          <p className="font-bold text-amber-900 mb-2">
            ⚠ La pestaña "Activos" no existe todavía
          </p>
          <p className="text-sm text-amber-900 mb-2">
            Crea una pestaña nueva en el Google Sheet de Hermes llamada{' '}
            <code className="bg-white px-1 rounded">Activos</code> y pega esta
            fila de encabezados en la primera línea:
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
        <Input label="Unidad" value={form.unidad} onChange={(v) => setForm({ ...form, unidad: v })} required />
        <Input label="Modelo" value={form.modelo} onChange={(v) => setForm({ ...form, modelo: v })} required />
        <Input label="Marca" value={form.marca} onChange={(v) => setForm({ ...form, marca: v })} />
        <Input label="Año" type="number" value={form.ano} onChange={(v) => setForm({ ...form, ano: v })} />
        <Input label="Fecha adquisición" type="date" value={form.fecha_adquisicion} onChange={(v) => setForm({ ...form, fecha_adquisicion: v })} required />
        <Input label="Costo adquisición (MXN)" type="number" value={form.costo_adquisicion} onChange={(v) => setForm({ ...form, costo_adquisicion: v })} required />
        <Input label="Vida útil (años)" type="number" value={form.vida_util_anos} onChange={(v) => setForm({ ...form, vida_util_anos: v })} />
        <Input label="Valor residual (MXN)" type="number" value={form.valor_residual} onChange={(v) => setForm({ ...form, valor_residual: v })} />
        <Select label="Método" value={form.metodo} options={['Lineal', 'Saldo Decreciente']} onChange={(v) => setForm({ ...form, metodo: v as AssetForm['metodo'] })} />
        <Input label="Horas totales vida" type="number" value={form.horas_totales_vida} onChange={(v) => setForm({ ...form, horas_totales_vida: v })} />
        <Select label="Segmento" value={form.segmento} options={['Renta', 'Transporte', 'Ambos']} onChange={(v) => setForm({ ...form, segmento: v as AssetForm['segmento'] })} />
        <Input label="Notas" value={form.notas} onChange={(v) => setForm({ ...form, notas: v })} />

        <div className="col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 text-white font-semibold py-2.5 hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : 'Registrar activo'}
          </button>
        </div>
      </form>

      <h2 className="text-lg font-semibold mb-2">Registros existentes</h2>
      {rows === null && !tabMissing && (
        <p className="text-sm text-gray-500">Cargando…</p>
      )}
      {rows !== null && rows.length <= 1 && (
        <p className="text-sm text-gray-500">
          Sin registros todavía. Crea el primero arriba.
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
