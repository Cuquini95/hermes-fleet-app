/**
 * Admin · Proveedores
 * Vendor master data — feeds the Órdenes de Compra creation form
 * with auto-fill (RFC, dirección, etc.) when a vendor is selected.
 */

import { useEffect, useState } from 'react'
import { appendRow, readRange, SHEET_TABS } from '../lib/sheets-api'

const HEADERS = [
  'NOMBRE', 'RFC', 'DIRECCION', 'CIUDAD', 'ESTADO', 'CP',
  'TELEFONO', 'EMAIL', 'CONTACTO', 'NOTAS',
]

interface VendorForm {
  nombre: string
  rfc: string
  direccion: string
  ciudad: string
  estado: string
  cp: string
  telefono: string
  email: string
  contacto: string
  notas: string
}

const empty: VendorForm = {
  nombre: '', rfc: '', direccion: '', ciudad: '', estado: '',
  cp: '', telefono: '', email: '', contacto: '', notas: '',
}

export default function AdminProveedoresPage() {
  const [rows, setRows] = useState<string[][] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<VendorForm>(empty)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const data = await readRange(SHEET_TABS.PROVEEDORES)
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  useEffect(() => { void load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSuccess(null)
    try {
      const row = [
        form.nombre.trim(), form.rfc.trim().toUpperCase(),
        form.direccion.trim(), form.ciudad.trim(), form.estado.trim(),
        form.cp.trim(), form.telefono.trim(), form.email.trim(),
        form.contacto.trim(), form.notas.trim(),
      ]
      await appendRow(SHEET_TABS.PROVEEDORES, row)
      setSuccess(`Proveedor "${form.nombre}" registrado.`)
      setForm(empty)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">Proveedores</h1>
      <p className="text-sm text-gray-600 mb-6">
        Catálogo de proveedores. Al crear una OC, se selecciona un proveedor y
        sus datos (RFC + dirección) se llenan automáticamente.
      </p>

      {success && (
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 text-green-800 px-3 py-2 text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border shadow-sm p-4 grid grid-cols-2 gap-3 mb-6"
      >
        <div className="col-span-2">
          <Input label="Nombre / Razón social" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} required />
        </div>
        <Input label="RFC" value={form.rfc} onChange={(v) => setForm({ ...form, rfc: v })} required />
        <Input label="Teléfono" value={form.telefono} onChange={(v) => setForm({ ...form, telefono: v })} />
        <div className="col-span-2">
          <Input label="Dirección" value={form.direccion} onChange={(v) => setForm({ ...form, direccion: v })} required />
        </div>
        <Input label="Ciudad" value={form.ciudad} onChange={(v) => setForm({ ...form, ciudad: v })} />
        <Input label="Estado" value={form.estado} onChange={(v) => setForm({ ...form, estado: v })} />
        <Input label="CP" value={form.cp} onChange={(v) => setForm({ ...form, cp: v })} />
        <Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <div className="col-span-2">
          <Input label="Contacto principal" value={form.contacto} onChange={(v) => setForm({ ...form, contacto: v })} />
        </div>
        <div className="col-span-2">
          <Input label="Notas" value={form.notas} onChange={(v) => setForm({ ...form, notas: v })} />
        </div>

        <div className="col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 text-white font-semibold py-2.5 hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : 'Registrar proveedor'}
          </button>
        </div>
      </form>

      <h2 className="text-lg font-semibold mb-2">Proveedores registrados</h2>
      {rows === null && <p className="text-sm text-gray-500">Cargando…</p>}
      {rows !== null && rows.length <= 1 && (
        <p className="text-sm text-gray-500">Sin proveedores todavía. Crea el primero arriba.</p>
      )}
      {rows !== null && rows.length > 1 && (
        <div className="overflow-x-auto bg-white border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>
                {HEADERS.map((h) => (
                  <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>
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
  )
}

interface InputProps {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
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
  )
}
