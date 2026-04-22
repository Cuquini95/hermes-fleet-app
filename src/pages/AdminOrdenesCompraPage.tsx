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

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Trash2, FileText, Printer, AlertTriangle, Pencil, X } from 'lucide-react'
import { appendRow, readRange, updateCell, deleteRow, upsertRow, SHEET_TABS } from '../lib/sheets-api'

const COMPANY = {
  name: 'ULTRATK SA DE CV',
  street: 'Juarez 312, Revolucion',
  city: 'Tecalitlan, Jalisco',
  phone: 'Tel: 314-115-1515',
}

const IVA_RATE = 0.16
const ESTADOS = ['Borrador', 'Aprobada', 'Recibida', 'Pagada', 'Rechazada'] as const
type EstadoOC = typeof ESTADOS[number]

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

/** DD/MM/YYYY → YYYY-MM-DD for <input type="date"> */
function ddToISO(dmy: string): string {
  if (!dmy) return todayIso()
  const parts = dmy.split('/')
  if (parts.length !== 3) return todayIso()
  const [d, m, y] = parts
  if (!d || !m || !y) return todayIso()
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function nextOcId(rows: string[][] | null): string {
  if (!rows) return 'OC-001'
  let max = 0
  for (const r of rows) {
    const match = /^OC-(\d+)$/.exec((r[0] ?? '').trim())
    if (match && match[1]) max = Math.max(max, parseInt(match[1], 10))
  }
  return `OC-${String(max + 1).padStart(3, '0')}`
}

function parseVendor(row: string[]): Vendor {
  return {
    nombre:    (row[0] ?? '').trim(),
    rfc:       (row[1] ?? '').trim(),
    direccion: (row[2] ?? '').trim(),
    ciudad:    (row[3] ?? '').trim(),
    estado:    (row[4] ?? '').trim(),
    cp:        (row[5] ?? '').trim(),
    telefono:  (row[6] ?? '').trim(),
    email:     (row[7] ?? '').trim(),
    contacto:  (row[8] ?? '').trim(),
  }
}

function parseOCRow(r: string[]): OCRow {
  return {
    oc_id:     (r[0]  ?? '').trim(),
    fecha:     (r[1]  ?? '').trim(),
    proveedor: (r[2]  ?? '').trim(),
    total:     (r[10] ?? '').trim(),
    estado:    (r[11] ?? '').trim(),
  }
}

function estadoColor(s: string) {
  switch (s) {
    case 'Aprobada':  return 'border-green-300 text-green-700'
    case 'Recibida':  return 'border-blue-300 text-blue-700'
    case 'Pagada':    return 'border-teal-300 text-teal-700'
    case 'Rechazada': return 'border-red-300 text-red-700'
    default:          return 'border-gray-300 text-gray-600'
  }
}

export default function AdminOrdenesCompraPage() {
  const formRef = useRef<HTMLFormElement>(null)

  // ── Loaded data ──────────────────────────────────────────────────────
  const [vendors, setVendors]     = useState<Vendor[] | null>(null)
  const [ocs, setOcs]             = useState<OCRow[] | null>(null)
  const [ocRawRows, setOcRawRows] = useState<string[][] | null>(null)   // full raw rows for edit
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState<string | null>(null)

  // ── Form state ───────────────────────────────────────────────────────
  const [editOcId, setEditOcId]     = useState<string | null>(null)       // null = create, string = edit
  const [loadingEdit, setLoadingEdit] = useState(false)
  const [ocId, setOcId]             = useState('OC-001')
  const [fecha, setFecha]           = useState(todayIso())
  const [vendorIdx, setVendorIdx]   = useState<number>(-1)
  const [unidad, setUnidad]         = useState('FLOTA')
  const [lines, setLines]           = useState<LineItem[]>([{ ...blankLine }])
  const [envio, setEnvio]           = useState('0')
  const [otros, setOtros]           = useState('0')
  const [estado, setEstado]         = useState<EstadoOC>('Borrador')
  const [comentarios, setComentarios] = useState('')
  const [fechaEntrega, setFechaEntrega] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // ── Inline status change + delete ───────────────────────────────────
  const [changingEstado, setChangingEstado] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete]   = useState<string | null>(null)
  const [deleting, setDeleting]             = useState(false)

  const selectedVendor: Vendor | null =
    vendorIdx >= 0 && vendors ? (vendors[vendorIdx] ?? null) : null

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

      const dataRows = ocRows.slice(1).filter((r) => (r[0] ?? '').trim())
      setOcRawRows(dataRows)
      setOcs(dataRows.map(parseOCRow))
      setOcId(nextOcId(dataRows))
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
  const iva      = subtotal * IVA_RATE
  const envioNum = parseFloat(envio) || 0
  const otrosNum = parseFloat(otros) || 0
  const total    = subtotal + iva + envioNum + otrosNum

  // ── Line item helpers ────────────────────────────────────────────────
  function updateLine(i: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  function addLine() { setLines((prev) => [...prev, { ...blankLine }]) }
  function removeLine(i: number) {
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)))
  }

  function resetForm(nextId?: string) {
    setEditOcId(null)
    setOcId(nextId ?? ocId)
    setFecha(todayIso())
    setVendorIdx(-1)
    setUnidad('FLOTA')
    setLines([{ ...blankLine }])
    setEnvio('0')
    setOtros('0')
    setEstado('Borrador')
    setComentarios('')
    setFechaEntrega('')
  }

  // ── Load an existing OC into the form ────────────────────────────────
  async function startEdit(targetId: string) {
    const raw = ocRawRows?.find((r) => (r[0] ?? '').trim() === targetId)
    if (!raw) { setError(`No se encontró ${targetId} en los datos cargados.`); return }

    setLoadingEdit(true)
    setError(null)
    try {
      // Populate header fields from raw row
      // cols: 0=ocId 1=fecha 2=proveedor 3=rfc 4=dir 5=unidad 6=subtotal 7=iva 8=envio 9=otros 10=total 11=estado 12=comentarios 13='' 14=fechaEntrega
      setOcId(raw[0] ?? targetId)
      setFecha(ddToISO(raw[1] ?? ''))
      setUnidad(raw[5] ?? 'FLOTA')
      setEnvio(raw[8] ?? '0')
      setOtros(raw[9] ?? '0')
      setEstado((raw[11] ?? 'Borrador') as EstadoOC)
      setComentarios(raw[12] ?? '')
      setFechaEntrega(ddToISO(raw[14] ?? ''))

      // Match vendor by name
      const vendorName = (raw[2] ?? '').trim()
      const vIdx = vendors?.findIndex((v) => v.nombre === vendorName) ?? -1
      setVendorIdx(vIdx)

      // Load line items from OC_Lineas tab
      const lineRows = await readRange(SHEET_TABS.OC_LINEAS)
      const myLines = lineRows.filter((r) => (r[0] ?? '').trim() === targetId)
      setLines(
        myLines.length > 0
          ? myLines.map((r) => ({
              descripcion:    (r[2] ?? '').trim(),
              cantidad:       r[3] ?? '1',
              precio_unitario: r[4] ?? '',
            }))
          : [{ ...blankLine }],
      )

      setEditOcId(targetId)
      // Scroll form into view
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoadingEdit(false)
    }
  }

  // ── Submit: create or update ─────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccess(null)
    if (!selectedVendor) { setError('Selecciona un proveedor.'); return }
    const validLines = lines.filter((l) => l.descripcion.trim() && parseFloat(l.cantidad) > 0)
    if (validLines.length === 0) {
      setError('Agrega al menos una línea con descripción y cantidad.')
      return
    }
    setSubmitting(true)
    setError(null)

    const headerValues = [
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
    ]

    try {
      if (editOcId) {
        // ── UPDATE MODE ──
        await upsertRow(SHEET_TABS.ORDENES_COMPRA, editOcId, headerValues)
        // Delete all existing line items then rewrite
        for (let i = 0; i < 100; i++) {
          try { await deleteRow(SHEET_TABS.OC_LINEAS, { '0': editOcId }) }
          catch { break }
        }
      } else {
        // ── CREATE MODE ──
        await appendRow(SHEET_TABS.ORDENES_COMPRA, headerValues)
      }

      // Write line items (shared by both modes)
      for (let i = 0; i < validLines.length; i++) {
        const l = validLines[i]!
        const cantidad = parseFloat(l.cantidad) || 0
        const precio   = parseFloat(l.precio_unitario) || 0
        await appendRow(SHEET_TABS.OC_LINEAS, [
          ocId,
          String(i + 1),
          l.descripcion.trim(),
          String(cantidad),
          precio.toFixed(2),
          (cantidad * precio).toFixed(2),
        ])
      }

      const totalFmt = total.toLocaleString('es-MX', { minimumFractionDigits: 2 })
      setSuccess(
        editOcId
          ? `OC ${ocId} actualizada — Total $${totalFmt}`
          : `OC ${ocId} creada con ${validLines.length} línea(s) — Total $${totalFmt}`,
      )
      await load()
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Inline status change ─────────────────────────────────────────────
  async function handleEstadoChange(targetId: string, newEstado: string) {
    setChangingEstado(targetId)
    setError(null)
    try {
      await updateCell(SHEET_TABS.ORDENES_COMPRA, 0, targetId, 11, newEstado)
      setSuccess(`${targetId} → ${newEstado}`)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setChangingEstado(null)
    }
  }

  // ── Delete OC + its line items ───────────────────────────────────────
  async function handleDelete(targetId: string) {
    setDeleting(true)
    setError(null)
    try {
      await deleteRow(SHEET_TABS.ORDENES_COMPRA, { '0': targetId })
      for (let i = 0; i < 100; i++) {
        try { await deleteRow(SHEET_TABS.OC_LINEAS, { '0': targetId }) }
        catch { break }
      }
      setSuccess(`OC ${targetId} eliminada.`)
      setConfirmDelete(null)
      if (editOcId === targetId) resetForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setConfirmDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────
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
        <div className="mb-4 rounded-lg bg-green-50 border border-green-200 text-green-800 px-3 py-2 text-sm flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-3 text-green-600 hover:text-green-800"><X size={14} /></button>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-3 text-red-600 hover:text-red-800"><X size={14} /></button>
        </div>
      )}

      {/* ── Edit mode banner ──────────────────────────────────────────── */}
      {editOcId && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <Pencil size={15} className="shrink-0" />
          <span>Editando <strong>{editOcId}</strong> — modifica los campos y presiona <strong>Guardar cambios</strong></span>
          <button
            onClick={() => resetForm()}
            className="ml-auto flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900"
          >
            <X size={13} /> Cancelar
          </button>
        </div>
      )}

      {/* ── PO-styled form ────────────────────────────────────────────── */}
      <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-xl border shadow-sm overflow-hidden mb-8">

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

        {/* OC ID + Fecha + Unidad */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b bg-gray-50">
          <Input
            label="OC #"
            value={ocId}
            onChange={setOcId}
            required
            disabled={!!editOcId}   // lock ID in edit mode
          />
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
                        type="number" step="any" min="0"
                        value={line.cantidad}
                        onChange={(e) => updateLine(i, { cantidad: e.target.value })}
                        className="w-full border rounded px-2 py-1 text-sm text-right"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number" step="any" min="0"
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
              onChange={(e) => setEstado(e.target.value as EstadoOC)}
              className="w-full border rounded px-2 py-1.5 text-sm bg-white"
            >
              {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Input label="Fecha entrega (opcional)" type="date" value={fechaEntrega} onChange={setFechaEntrega} />
        </div>

        {/* Submit / Cancel */}
        <div className="p-4 flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-blue-600 text-white font-semibold py-2.5 hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting
              ? (editOcId ? 'Guardando cambios…' : 'Guardando…')
              : editOcId
                ? `Guardar cambios · Total $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                : `Crear OC · Total $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
            }
          </button>
          {editOcId && (
            <button
              type="button"
              onClick={() => resetForm()}
              disabled={submitting}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* ── List of OCs ───────────────────────────────────────────────── */}
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
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {ocs.map((o) => (
                <tr key={o.oc_id} className={`hover:bg-gray-50 ${editOcId === o.oc_id ? 'bg-amber-50' : ''}`}>
                  <td className="px-3 py-2 font-mono">
                    <FileText size={12} className="inline mr-1 text-gray-400" />
                    {o.oc_id}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{o.fecha}</td>
                  <td className="px-3 py-2">{o.proveedor}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">
                    ${parseFloat(o.total || '0').toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </td>

                  {/* Inline status dropdown */}
                  <td className="px-3 py-2">
                    <select
                      value={o.estado}
                      disabled={changingEstado === o.oc_id}
                      onChange={(e) => void handleEstadoChange(o.oc_id, e.target.value)}
                      className={`border rounded px-1.5 py-0.5 text-xs font-semibold bg-white cursor-pointer transition-opacity
                        ${estadoColor(o.estado)}
                        ${changingEstado === o.oc_id ? 'opacity-50' : ''}
                      `}
                    >
                      {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>

                  {/* Actions */}
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        to={`/admin/ordenes-compra/${encodeURIComponent(o.oc_id)}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                      >
                        <Printer size={12} /> Ver / Imprimir
                      </Link>
                      <button
                        onClick={() => void startEdit(o.oc_id)}
                        disabled={loadingEdit}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-amber-700 transition-colors disabled:opacity-50"
                        title={`Editar ${o.oc_id}`}
                      >
                        <Pencil size={13} /> Editar
                      </button>
                      <button
                        onClick={() => setConfirmDelete(o.oc_id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title={`Eliminar ${o.oc_id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Delete confirmation modal ─────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle size={18} className="text-red-600" />
              </span>
              <div>
                <p className="font-semibold text-gray-900">¿Eliminar {confirmDelete}?</p>
                <p className="mt-1 text-sm text-gray-500">
                  Se eliminará el encabezado y todas las líneas de esta OC.
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleDelete(confirmDelete)}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
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
  disabled?: boolean
}
function Input({ label, value, onChange, type = 'text', required, disabled }: InputProps) {
  return (
    <label className="flex flex-col text-xs text-gray-700">
      <span className="font-semibold mb-0.5">{label}{required && ' *'}</span>
      <input
        type={type}
        value={value}
        required={required}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded px-2 py-1.5 text-sm disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
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
        type="number" step="any" min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-24 border rounded px-2 py-0.5 text-sm text-right font-mono"
      />
    </div>
  )
}
