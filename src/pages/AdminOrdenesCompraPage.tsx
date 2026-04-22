/**
 * Admin · Órdenes de Compra
 *
 * PO format inspired by ULTRATK SA DE CV's Excel template:
 *   Header: OC #, fecha, vendedor (auto-fill from Proveedores)
 *   Body:   line items (item #, descripción, cantidad, precio unitario, total)
 *   Footer: subtotal, IVA 16 %, envío, otros, total + comentarios
 *
 * Two Sheets tabs:
 *   - 'Órdenes de Compra' — one row per OC (header + totals)
 *   - 'OC_Lineas'         — one row per line item, FK = OC_ID
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, FileText } from 'lucide-react'
import { appendRow, readRange, SHEET_TABS } from '../lib/sheets-api'

const COMPANY = {
  name: 'ULTRATK SA DE CV',
  street: 'Juarez 312, Revolucion',
  city: 'Tecalitlan, Jalisco',
  phone: 'Tel: 314-115-1515',
}

const IVA_RATE = 0.16

interface Vendor {
  nombre: string
  rfc: string
  direccion: string
  ciudad: string
  estado: string
  cp: string
  telefono: string
  email: string
  contacto: string
}

interface LineItem {
  descripcion: string
  cantidad: string
  precio_unitario: string
}

interface OCRow {
  oc_id: string
  fecha: string
  proveedor: string
  total: string
  estado: string
}

const blankLine: LineItem = { descripcion: '', cantidad: '1', precio_unitario: '' }

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function toDDMMYYYY(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function nextOcId(rows: string[][] | null): string {
  if (!rows) return 'OC-001'
  let max = 0
  for (const r of rows) {
    const m = /^OC-(\d+)$/.exec((r[0] ?? '').trim())
    if (m && m[1]) max = Math.max(max, parseInt(m[1], 10))
  }
  return `OC-${String(max + 1).padStart(3, '0')}`
}

function parseVendor(row: string[]): Vendor {
  return {
    nombre: (row[0] ?? '').trim(),
    rfc: (row[1] ?? '').trim(),
    direccion: (row[2] ?? '').trim(),
    ciudad: (row[3] ?? '').trim(),
    estado: (row[4] ?? '').trim(),
    cp: (row[5] ?? '').trim(),
    telefono: (row[6] ?? '').trim(),
    email: (row[7] ?? '').trim(),
    contacto: (row[8] ?? '').trim(),
  }
}

function parseOCRow(r: string[]): OCRow {
  return {
    oc_id: (r[0] ?? '').trim(),
    fecha: (r[1] ?? '').trim(),
    proveedor: (r[2] ?? '').trim(),
    total: (r[10] ?? '').trim(),
    estado: (r[11] ?? '').trim(),
  }
}

export default function AdminOrdenesCompraPage() {
  // ── Loaded data ──────────────────────────────────────────────────────
  const [vendors, setVendors] = useState<Vendor[] | null>(null)
  const [ocs, setOcs] = useState<OCRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // ── Form state ───────────────────────────────────────────────────────
  const [ocId, setOcId] = useState('OC-001')
  const [fecha, setFecha] = useState(todayIso())
  const [vendorIdx, setVendorIdx] = useState<number>(-1)
  const [unidad, setUnidad] = useState('FLOTA')
  const [lines, setLines] = useState<LineItem[]>([{ ...blankLine }])
  const [envio, setEnvio] = useState('0')
  const [otros, setOtros] = useState('0')
  const [estado, setEstado] = useState<'Borrador' | 'Aprobada' | 'Recibida' | 'Pagada' | 'Rechazada'>('Borrador')
  const [comentarios, setComentarios] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedVendor: Vendor | null = vendorIdx >= 0 && vendors ? vendors[vendorIdx] ?? null : null

  // ── Load vendor catalog + OC list ────────────────────────────────────
  async function load() {
    setError(null)
    try {
      const [vRows, ocRows] = await Promise.all([
        readRange(SHEET_TABS.PROVEEDORES),
        readRange(SHEET_TABS.ORDENES_COMPRA),
      ])
      const vendorList = vRows.slice(1).filter((r) => (r[0] ?? '').trim()).map(parseVendor)
      setVendors(vendorList)
      const ocList = ocRows.slice(1).filter((r) => (r[0] ?? '').trim()).map(parseOCRow)
      setOcs(ocList)
      setOcId(nextOcId(ocRows.slice(1)))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }
  useEffect(() => { void load() }, [])

  // ── Totals ───────────────────────────────────────────────────────────
  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (parseFloat(l.cantidad) || 0) * (parseFloat(l.precio_unitario) || 0), 0),
    [lines],
  )
  const iva = subtotal * IVA_RATE
  const envioNum = parseFloat(envio) || 0
  const otrosNum = parseFloat(otros) || 0
  const total = subtotal + iva + envioNum + otrosNum

  function updateLine(i: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function addLine() { setLines((prev) => [...prev, { ...blankLine }]) }
  function removeLine(i: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)))
  }

  function resetForm() {
    setVendorIdx(-1)
    setUnidad('FLOTA')
    setLines([{ ...blankLine }])
    setEnvio('0')
    setOtros('0')
    setEstado('Borrador')
    setComentarios('')
    setFechaEntrega('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccess(null)
    if (!selectedVendor) {
      setError('Selecciona un proveedor.')
      return
    }
    const validLines = lines.filter((l) => l.descripcion.trim() && parseFloat(l.cantidad) > 0)
    if (validLines.length === 0) {
      setError('Agrega al menos una línea con descripción y cantidad.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // Header row
      await appendRow(SHEET_TABS.ORDENES_COMPRA, [
        ocId,
        toDDMMYYYY(fecha),
        selectedVendor.nombre,
        selectedVendor.rfc,
        [selectedVendor.direccion, selectedVendor.ciudad, selectedVendor.estado, selectedVendor.cp]
          .filter(Boolean).join(', '),
        unidad.trim(),
        subtotal.toFixed(2),
        iva.toFixed(2),
        envioNum.toFixed(2),
        otrosNum.toFixed(2),
        total.toFixed(2),
        estado,
        comentarios.trim(),
        '',
        toDDMMYYYY(fechaEntrega),
      ])
      // Line rows
      for (let i = 0; i < validLines.length; i++) {
        const l = validLines[i]!
        const cantidad = parseFloat(l.cantidad) || 0
        const precio = parseFloat(l.precio_unitario) || 0
        await appendRow(SHEET_TABS.OC_LINEAS, [
          ocId,
          String(i + 1),
          l.descripcion.trim(),
          String(cantidad),
          precio.toFixed(2),
          (cantidad * precio).toFixed(2),
        ])
      }
      setSuccess(`OC ${ocId} creada con ${validLines.length} línea(s) — Total $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`)
      resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold">Órdenes de Compra</h1>
        <Link
          to="/admin/proveedores"
          className="text-sm rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50"
        >
          Gestionar proveedores →
        </Link>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Crea órdenes de compra con formato profesional. Selecciona un proveedor del catálogo
        y sus datos se llenan automáticamente.
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

      {/* PO-styled form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">
        {/* PO header band */}
        <div className="bg-[#162252] text-white px-5 py-4 flex items-start justify-between">
          <div>
            <p className="font-bold">{COMPANY.name}</p>
            <p className="text-xs opacity-80">{COMPANY.street}</p>
            <p className="text-xs opacity-80">{COMPANY.city} · {COMPANY.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-xs opacity-80">ORDEN DE COMPRA</p>
            <p className="font-mono text-lg">{ocId}</p>
            <p className="text-xs opacity-80 mt-1">FECHA: {toDDMMYYYY(fecha) || '—'}</p>
          </div>
        </div>

        {/* OC ID + Fecha override */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b bg-gray-50">
          <Input label="OC #" value={ocId} onChange={setOcId} required />
          <Input label="Fecha" type="date" value={fecha} onChange={setFecha} required />
          <Input label="Unidad asignada" value={unidad} onChange={setUnidad} />
        </div>

        {/* Vendedor */}
        <div className="p-4 border-b">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Vendedor</p>
          <select
            value={vendorIdx}
            onChange={(e) => setVendorIdx(Number(e.target.value))}
            className="w-full border rounded px-3 py-2 text-sm bg-white mb-3"
            required
          >
            <option value={-1}>— Selecciona un proveedor —</option>
            {vendors?.map((v, i) => (
              <option key={i} value={i}>{v.nombre} {v.rfc ? `· ${v.rfc}` : ''}</option>
            ))}
          </select>

          {selectedVendor && (
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
              <p className="font-semibold">{selectedVendor.nombre}</p>
              {selectedVendor.rfc && <p>RFC: {selectedVendor.rfc}</p>}
              {selectedVendor.direccion && <p>{selectedVendor.direccion}</p>}
              {(selectedVendor.ciudad || selectedVendor.estado || selectedVendor.cp) && (
                <p>
                  {[selectedVendor.ciudad, selectedVendor.estado].filter(Boolean).join(', ')}
                  {selectedVendor.cp ? ` C.P. ${selectedVendor.cp}` : ''}
                </p>
              )}
              {selectedVendor.telefono && <p>Tel: {selectedVendor.telefono}</p>}
              {selectedVendor.contacto && <p>Contacto: {selectedVendor.contacto}</p>}
            </div>
          )}

          {vendors && vendors.length === 0 && (
            <p className="text-xs text-amber-700 mt-2">
              No hay proveedores en el catálogo.{' '}
              <Link to="/admin/proveedores" className="underline">Agrega el primero</Link>.
            </p>
          )}
        </div>

        {/* Líneas */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Items</p>
            <button type="button" onClick={addLine}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800">
              <Plus size={14} /> Agregar línea
            </button>
          </div>

          <table className="w-full text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="text-left font-semibold pb-1 w-8">#</th>
                <th className="text-left font-semibold pb-1">Descripción</th>
                <th className="text-right font-semibold pb-1 w-20">Cant.</th>
                <th className="text-right font-semibold pb-1 w-32">P. Unit.</th>
                <th className="text-right font-semibold pb-1 w-32">Total</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const lineTotal = (parseFloat(line.cantidad) || 0) * (parseFloat(line.precio_unitario) || 0)
                return (
                  <tr key={i} className="border-t">
                    <td className="py-1 text-gray-500">{i + 1}</td>
                    <td className="py-1 pr-2">
                      <input
                        type="text"
                        value={line.descripcion}
                        onChange={(e) => updateLine(i, { descripcion: e.target.value })}
                        placeholder="Descripción del item"
                        className="w-full border rounded px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={line.cantidad}
                        onChange={(e) => updateLine(i, { cantidad: e.target.value })}
                        className="w-full border rounded px-2 py-1 text-sm text-right"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={line.precio_unitario}
                        onChange={(e) => updateLine(i, { precio_unitario: e.target.value })}
                        className="w-full border rounded px-2 py-1 text-sm text-right"
                      />
                    </td>
                    <td className="py-1 pr-2 text-right font-mono tabular-nums">
                      ${lineTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-1 text-right">
                      {lines.length > 1 && (
                        <button type="button" onClick={() => removeLine(i)}
                          className="text-gray-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Totals + comments */}
        <div className="grid grid-cols-2 gap-4 p-4 border-b">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              Comentarios
            </label>
            <textarea
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              rows={4}
              className="w-full border rounded px-2 py-1.5 text-sm"
              placeholder="Precios en Pesos Mexicanos…"
            />
            <p className="text-xs text-gray-400 mt-1">Precios en Pesos Mexicanos · IVA 16%</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <Row label="Subtotal" value={subtotal} />
            <Row label="IVA (16%)" value={iva} />
            <RowEditable label="Envío" value={envio} onChange={setEnvio} />
            <RowEditable label="Otros" value={otros} onChange={setOtros} />
            <div className="border-t mt-2 pt-2">
              <Row label="TOTAL" value={total} bold />
            </div>
          </div>
        </div>

        {/* Estado + entrega */}
        <div className="grid grid-cols-2 gap-3 p-4 border-b bg-gray-50">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as typeof estado)}
              className="w-full border rounded px-2 py-1.5 text-sm bg-white"
            >
              {['Borrador', 'Aprobada', 'Recibida', 'Pagada', 'Rechazada'].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <Input label="Fecha entrega (opcional)" type="date" value={fechaEntrega} onChange={setFechaEntrega} />
        </div>

        <div className="p-4">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 text-white font-semibold py-2.5 hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Guardando…' : `Crear OC · Total $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`}
          </button>
        </div>
      </form>

      {/* List of OCs */}
      <h2 className="text-lg font-semibold mb-2">Órdenes registradas</h2>
      {ocs === null && <p className="text-sm text-gray-500">Cargando…</p>}
      {ocs !== null && ocs.length === 0 && (
        <p className="text-sm text-gray-500">Sin órdenes todavía.</p>
      )}
      {ocs !== null && ocs.length > 0 && (
        <div className="overflow-x-auto bg-white border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">OC #</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Fecha</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Proveedor</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Total</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ocs.map((o) => (
                <tr key={o.oc_id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono">
                    <FileText size={12} className="inline mr-1 text-gray-400" />
                    {o.oc_id}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{o.fecha}</td>
                  <td className="px-3 py-2">{o.proveedor}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    ${parseFloat(o.total || '0').toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2">{o.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────

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

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-0.5 ${bold ? 'font-bold text-base' : ''}`}>
      <span className="text-gray-600">{label}</span>
      <span className="font-mono tabular-nums">
        ${value.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
      </span>
    </div>
  )
}

function RowEditable({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-gray-600">{label}</span>
      <input
        type="number"
        step="any"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 border rounded px-2 py-0.5 text-sm text-right font-mono"
      />
    </div>
  )
}
