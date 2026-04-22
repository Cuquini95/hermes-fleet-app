/**
 * Printable Orden de Compra — laid out to match the ULTRATK PO template.
 *
 * Renders one OC by ID: reads the header row from "Órdenes de Compra" and
 * the matching lines from "OC_Lineas", then exposes a window.print() button
 * that browsers convert to PDF (Save As PDF in the print dialog).
 */

import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { readRange, SHEET_TABS } from '../lib/sheets-api'

const COMPANY = {
  name: 'ULTRATK SA DE CV',
  street: 'Juarez 312, Revolucion',
  city: 'Tecalitlan, Jalisco',
  phone: 'Tel: 314-115-1515',
  signer: 'TOMAS EMMANUEL MORA SOTO',
}

interface OCHeader {
  oc_id: string
  fecha: string
  proveedor_nombre: string
  proveedor_rfc: string
  proveedor_direccion: string
  unidad: string
  subtotal: number
  iva: number
  envio: number
  otros: number
  total: number
  estado: string
  comentarios: string
  aprobada_por: string
  fecha_entrega: string
}

interface OCLine {
  numero: number
  descripcion: string
  cantidad: number
  precio_unitario: number
  total: number
}

function num(v: string | undefined): number {
  return parseFloat((v ?? '').replace(/,/g, '')) || 0
}
function fmt(n: number): string {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function OrdenCompraPrintPage() {
  const { ocId = '' } = useParams<{ ocId: string }>()
  const [header, setHeader] = useState<OCHeader | null>(null)
  const [lines, setLines] = useState<OCLine[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [hdrRows, lineRows] = await Promise.all([
          readRange(SHEET_TABS.ORDENES_COMPRA),
          readRange(SHEET_TABS.OC_LINEAS),
        ])
        if (cancelled) return

        const match = hdrRows
          .slice(1)
          .find((r) => (r[0] ?? '').trim().toUpperCase() === ocId.toUpperCase())
        if (!match) {
          setError(`OC ${ocId} no encontrada.`)
          setLoaded(true)
          return
        }
        setHeader({
          oc_id: (match[0] ?? '').trim(),
          fecha: (match[1] ?? '').trim(),
          proveedor_nombre: (match[2] ?? '').trim(),
          proveedor_rfc: (match[3] ?? '').trim(),
          proveedor_direccion: (match[4] ?? '').trim(),
          unidad: (match[5] ?? '').trim(),
          subtotal: num(match[6]),
          iva: num(match[7]),
          envio: num(match[8]),
          otros: num(match[9]),
          total: num(match[10]),
          estado: (match[11] ?? '').trim(),
          comentarios: (match[12] ?? '').trim(),
          aprobada_por: (match[13] ?? '').trim(),
          fecha_entrega: (match[14] ?? '').trim(),
        })

        const matchingLines = lineRows
          .slice(1)
          .filter((r) => (r[0] ?? '').trim().toUpperCase() === ocId.toUpperCase())
          .map<OCLine>((r) => ({
            numero: parseInt((r[1] ?? '0').trim(), 10) || 0,
            descripcion: (r[2] ?? '').trim(),
            cantidad: num(r[3]),
            precio_unitario: num(r[4]),
            total: num(r[5]),
          }))
          .sort((a, b) => a.numero - b.numero)
        setLines(matchingLines)
        setLoaded(true)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setLoaded(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ocId])

  if (!loaded) {
    return <div className="p-8 text-sm text-gray-500">Cargando OC {ocId}…</div>
  }

  if (error || !header) {
    return (
      <div className="p-8">
        <Link to="/admin/ordenes-compra" className="text-sm text-blue-600 hover:underline">
          ← Volver
        </Link>
        <p className="mt-4 text-red-700 bg-red-50 border border-red-200 rounded p-3 text-sm">
          {error ?? 'OC no encontrada'}
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: letter; margin: 1cm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .po-page { box-shadow: none !important; border: none !important; margin: 0 !important; max-width: none !important; }
        }
      `}</style>

      {/* Toolbar (hidden when printing) */}
      <div className="no-print sticky top-0 z-10 bg-gray-100 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <Link
          to="/admin/ordenes-compra"
          className="inline-flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900"
        >
          <ArrowLeft size={16} /> Volver
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white text-sm font-semibold px-4 py-2 hover:bg-blue-700"
        >
          <Printer size={16} /> Imprimir / Guardar como PDF
        </button>
      </div>

      {/* Printable page */}
      <div className="po-page bg-white shadow-md max-w-4xl mx-auto my-6 px-12 py-10 text-sm text-gray-900 font-serif">
        {/* Header band */}
        <div className="flex items-start justify-between border-b-2 border-gray-900 pb-4 mb-6">
          <div>
            <p className="text-2xl font-extrabold tracking-tight">{COMPANY.name}</p>
            <p className="text-xs text-gray-700">{COMPANY.street}</p>
            <p className="text-xs text-gray-700">{COMPANY.city}</p>
            <p className="text-xs text-gray-700">{COMPANY.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold tracking-widest text-gray-900">
              ORDEN DE COMPRA
            </p>
            <table className="ml-auto mt-2 text-xs">
              <tbody>
                <tr>
                  <td className="font-semibold pr-3 text-gray-600 text-right">FECHA</td>
                  <td className="font-mono">{header.fecha || '—'}</td>
                </tr>
                <tr>
                  <td className="font-semibold pr-3 text-gray-600 text-right">OC #</td>
                  <td className="font-mono">{header.oc_id}</td>
                </tr>
                {header.unidad && (
                  <tr>
                    <td className="font-semibold pr-3 text-gray-600 text-right">UNIDAD</td>
                    <td className="font-mono">{header.unidad}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vendedor */}
        <div className="mb-6">
          <p className="text-xs font-bold tracking-widest text-gray-600 mb-1">VENDEDOR</p>
          <div className="border border-gray-300 rounded p-3 bg-gray-50">
            <p className="font-bold text-base">{header.proveedor_nombre || '—'}</p>
            {header.proveedor_rfc && (
              <p className="text-xs text-gray-700">RFC: {header.proveedor_rfc}</p>
            )}
            {header.proveedor_direccion && (
              <p className="text-xs text-gray-700 whitespace-pre-line">
                {header.proveedor_direccion}
              </p>
            )}
          </div>
        </div>

        {/* Line items */}
        <table className="w-full border-collapse mb-6 text-sm">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="border border-gray-900 px-2 py-2 text-left text-xs font-bold w-12">ITEM #</th>
              <th className="border border-gray-900 px-2 py-2 text-left text-xs font-bold">DESCRIPCION</th>
              <th className="border border-gray-900 px-2 py-2 text-right text-xs font-bold w-20">CANTIDAD</th>
              <th className="border border-gray-900 px-2 py-2 text-right text-xs font-bold w-32">PRECIO UNITARIO</th>
              <th className="border border-gray-900 px-2 py-2 text-right text-xs font-bold w-32">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={5} className="border border-gray-300 px-2 py-3 text-center text-xs text-gray-500">
                  Sin líneas registradas
                </td>
              </tr>
            )}
            {lines.map((l) => (
              <tr key={l.numero}>
                <td className="border border-gray-300 px-2 py-1.5 text-center font-mono">{l.numero}</td>
                <td className="border border-gray-300 px-2 py-1.5">{l.descripcion}</td>
                <td className="border border-gray-300 px-2 py-1.5 text-right font-mono tabular-nums">
                  {l.cantidad.toLocaleString('es-MX')}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-right font-mono tabular-nums">
                  ${fmt(l.precio_unitario)}
                </td>
                <td className="border border-gray-300 px-2 py-1.5 text-right font-mono tabular-nums">
                  ${fmt(l.total)}
                </td>
              </tr>
            ))}
            {/* Totals rows */}
            <tr>
              <td colSpan={3}></td>
              <td className="border border-gray-300 px-2 py-1.5 text-right text-xs font-bold text-gray-700">SUBTOTAL</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right font-mono tabular-nums">
                ${fmt(header.subtotal)}
              </td>
            </tr>
            <tr>
              <td colSpan={3}></td>
              <td className="border border-gray-300 px-2 py-1.5 text-right text-xs font-bold text-gray-700">IVA (16%)</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right font-mono tabular-nums">
                ${fmt(header.iva)}
              </td>
            </tr>
            <tr>
              <td colSpan={3}></td>
              <td className="border border-gray-300 px-2 py-1.5 text-right text-xs font-bold text-gray-700">ENVIO</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right font-mono tabular-nums">
                ${fmt(header.envio)}
              </td>
            </tr>
            <tr>
              <td colSpan={3}></td>
              <td className="border border-gray-300 px-2 py-1.5 text-right text-xs font-bold text-gray-700">OTROS</td>
              <td className="border border-gray-300 px-2 py-1.5 text-right font-mono tabular-nums">
                ${fmt(header.otros)}
              </td>
            </tr>
            <tr className="bg-gray-100">
              <td colSpan={3}></td>
              <td className="border border-gray-900 px-2 py-2 text-right text-sm font-extrabold">TOTAL</td>
              <td className="border border-gray-900 px-2 py-2 text-right font-mono tabular-nums text-base font-extrabold">
                ${fmt(header.total)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Comments + status */}
        <div className="grid grid-cols-2 gap-6 mb-10">
          <div>
            <p className="text-xs font-bold tracking-widest text-gray-600 mb-1">COMENTARIOS</p>
            <p className="text-xs text-gray-800 whitespace-pre-line min-h-[3rem]">
              {header.comentarios || 'Precios en Pesos Mexicanos'}
            </p>
          </div>
          <div className="text-xs text-gray-700">
            <p><span className="font-semibold text-gray-600">Estado:</span> {header.estado || '—'}</p>
            {header.fecha_entrega && (
              <p><span className="font-semibold text-gray-600">Fecha entrega:</span> {header.fecha_entrega}</p>
            )}
            {header.aprobada_por && (
              <p><span className="font-semibold text-gray-600">Aprobada por:</span> {header.aprobada_por}</p>
            )}
          </div>
        </div>

        {/* Signature */}
        <div className="mt-16">
          <div className="w-72 border-t border-gray-900 pt-1">
            <p className="text-xs font-bold uppercase tracking-wide">{COMPANY.signer}</p>
            <p className="text-[10px] text-gray-500">Firma autorizada</p>
          </div>
        </div>
      </div>
    </>
  )
}
