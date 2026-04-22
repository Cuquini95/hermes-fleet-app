/**
 * Printable Orden de Compra — visual replica of ULTRATK's Excel template:
 *   - Red ULTRATK logo block (top-left)
 *   - Big red "ORDEN DE COMPRA" title (top-right)
 *   - Red FECHA / OC # boxes
 *   - Red VENDEDOR banner with white text
 *   - Red items table header band
 *   - Right-aligned totals stack (SUBTOTAL / IVA / ENVIO / OTROS / TOTAL)
 *   - Grey "Comentarios" banner + signature line
 *
 * Uses native window.print() — browsers offer "Save as PDF" in the dialog.
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

const RED = '#E2231A'
const TABLE_MIN_ROWS = 8

/** OC states where the buyer has authorized the document — overlay the signature image. */
const SIGNED_STATES = new Set(['Aprobada', 'Recibida', 'Pagada'])

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
function fmtOrDash(n: number): string {
  return n > 0 ? fmt(n) : '-'
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

  if (!loaded) return <div className="p-8 text-sm text-gray-500">Cargando OC {ocId}…</div>
  if (error || !header) {
    return (
      <div className="p-8">
        <Link to="/admin/ordenes-compra" className="text-sm text-blue-600 hover:underline">← Volver</Link>
        <p className="mt-4 text-red-700 bg-red-50 border border-red-200 rounded p-3 text-sm">
          {error ?? 'OC no encontrada'}
        </p>
      </div>
    )
  }

  // Pad table to a minimum number of visual rows to mimic the Excel grid feel
  const blankRows = Math.max(0, TABLE_MIN_ROWS - lines.length)

  return (
    <>
      <style>{`
        /* Force background colors to render in PDF / printer output.
           Without this, browsers strip red banners (ULTRATK logo, VENDEDOR
           bar, items table header) and they print as outlines only. */
        .po-page, .po-page * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }

        @media print {
          /* Use a 0 page margin so the .po-page's own padding controls the
             printable border — keeps proportions identical to screen. */
          @page { size: letter; margin: 0; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }

          /* Hide everything except the PO page. */
          body * { visibility: hidden !important; }
          .po-page, .po-page * { visibility: visible !important; }

          /* Pin the PO page to the printable area at letter width. */
          .po-page {
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            width: 8.5in !important;
            max-width: 8.5in !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
          }

          table, tr, .po-page { page-break-inside: avoid; }
          html { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        }
      `}</style>

      {/* Toolbar — hidden when printing */}
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

      {/* PO page */}
      <div
        className="po-page bg-white shadow-md mx-auto my-6 px-12 py-10 text-[12px] text-gray-900"
        style={{ maxWidth: '8.5in', fontFamily: 'Arial, Helvetica, sans-serif' }}
      >
        {/* Header row: logo (left) + title + boxes (right) */}
        <div className="flex items-start justify-between mb-6">
          {/* ULTRATK logo block */}
          <div className="flex flex-col items-start" style={{ width: 200 }}>
            <div
              className="flex flex-col items-center justify-center text-white font-extrabold tracking-tight"
              style={{ backgroundColor: RED, width: 200, height: 78, padding: '8px 4px' }}
            >
              <span style={{ fontSize: 30, lineHeight: 1 }}>ULTRATK</span>
              <span style={{ fontSize: 8, letterSpacing: '0.15em', marginTop: 4 }}>
                INGENIERIA·CONSTRUCCION
              </span>
            </div>
          </div>

          {/* Title + boxes */}
          <div className="flex-1 text-right ml-6">
            <p
              className="font-extrabold tracking-tight"
              style={{ color: RED, fontSize: 38, lineHeight: 1 }}
            >
              ORDEN DE COMPRA
            </p>
            <table className="ml-auto mt-3 text-[11px]" style={{ borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td className="pr-3 font-semibold text-right">FECHA</td>
                  <td>
                    <span
                      className="inline-block px-3 py-1 font-mono text-center"
                      style={{ border: `1.5px solid ${RED}`, minWidth: 110 }}
                    >
                      {header.fecha || ''}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="pr-3 font-semibold text-right pt-1">OC #</td>
                  <td className="pt-1">
                    <span
                      className="inline-block px-3 py-1 font-mono text-center"
                      style={{ border: `1.5px solid ${RED}`, minWidth: 110 }}
                    >
                      {header.oc_id}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Buyer info block */}
        <div className="mb-6 leading-tight">
          <p className="font-semibold">{COMPANY.name}</p>
          <p>{COMPANY.street}</p>
          <p>{COMPANY.city}</p>
          <p>{COMPANY.phone}</p>
        </div>

        {/* VENDEDOR red banner */}
        <div
          className="text-white font-bold uppercase tracking-wide text-[11px] px-3 py-1 mb-2"
          style={{ backgroundColor: RED, width: 280 }}
        >
          VENDEDOR
        </div>
        <div className="mb-6 leading-tight">
          <p className="font-semibold">{header.proveedor_nombre || '—'}</p>
          {header.proveedor_rfc && <p>{header.proveedor_rfc}</p>}
          {header.proveedor_direccion && (
            <p className="whitespace-pre-line">{header.proveedor_direccion}</p>
          )}
        </div>

        {/* Items table — explicit 1px black borders that survive print engines.
            Empty cells get a non-breaking space so their bottom border doesn't
            collapse, and every row is locked at 26px height. */}
        <table
          className="w-full mb-2"
          style={{ fontSize: 11, borderCollapse: 'collapse', border: '1px solid #000' }}
        >
          <thead>
            <tr style={{ backgroundColor: RED, color: 'white' }}>
              <th style={{ ...thStyle, width: '8%' }}>ITEM #</th>
              <th style={{ ...thStyle, width: '38%' }}>DESCRIPCION</th>
              <th style={{ ...thStyle, width: '12%' }}>CANTIDAD</th>
              <th style={{ ...thStyle, width: '21%' }}>PRECIO UNITARIO</th>
              <th style={{ ...thStyle, width: '21%' }}>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.numero} style={{ height: 26 }}>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{l.numero}</td>
                <td style={tdStyle}>{l.descripcion}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  {l.cantidad > 0 ? l.cantidad.toLocaleString('es-MX') : '-'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }} className="tabular-nums">
                  {l.precio_unitario > 0 ? fmt(l.precio_unitario) : '-'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', backgroundColor: '#F3F3F3' }} className="tabular-nums">
                  {fmtOrDash(l.total)}
                </td>
              </tr>
            ))}
            {Array.from({ length: blankRows }).map((_, i) => (
              <tr key={`blank-${i}`} style={{ height: 26 }}>
                <td style={tdStyle}>&nbsp;</td>
                <td style={tdStyle}>&nbsp;</td>
                <td style={tdStyle}>&nbsp;</td>
                <td style={tdStyle}>&nbsp;</td>
                <td style={{ ...tdStyle, textAlign: 'right', backgroundColor: '#F3F3F3' }} className="tabular-nums">
                  -
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Comments + totals */}
        <div className="grid mb-10" style={{ gridTemplateColumns: '55% 45%', gap: 0 }}>
          <div>
            <div
              className="px-3 py-1 font-bold text-[11px]"
              style={{ backgroundColor: '#D9D9D9', borderTop: '1px solid #888', borderLeft: '1px solid #888', borderRight: '1px solid #888' }}
            >
              Comentarios
            </div>
            <div
              className="px-3 py-2 text-[11px] whitespace-pre-line"
              style={{ minHeight: 80, border: '1px solid #888', borderTop: 'none' }}
            >
              {header.comentarios || 'Precios en Pesos Mexicanos'}
            </div>
          </div>
          <div className="pl-6">
            <table className="w-full text-[11px]" style={{ borderCollapse: 'collapse' }}>
              <tbody>
                <TotalRow label="SUBTOTAL" value={fmt(header.subtotal)} />
                <TotalRow label="IVA" value={fmt(header.iva)} />
                <TotalRow label="ENVIO" value={fmtOrDash(header.envio)} />
                <TotalRow label="OTROS" value={fmtOrDash(header.otros)} />
                <tr>
                  <td className="px-2 py-2 text-right font-extrabold" style={{ borderTop: '2px solid #000' }}>
                    TOTAL
                  </td>
                  <td className="px-2 py-2 text-right font-extrabold tabular-nums" style={{ borderTop: '2px solid #000' }}>
                    $ {fmt(header.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Signature — image overlays the line when the OC is signed-off */}
        <div className="mt-12">
          <div className="inline-block relative" style={{ minWidth: 280 }}>
            {SIGNED_STATES.has(header.estado) && (
              <img
                src="/signature-tomas.png"
                alt="Firma autorizada"
                style={{
                  position: 'absolute',
                  bottom: 4,
                  left: 20,
                  height: 110,
                  width: 'auto',
                  pointerEvents: 'none',
                }}
              />
            )}
            <div className="border-t border-gray-700 pt-1" style={{ minWidth: 280 }}>
              <p className="text-[11px] font-bold uppercase tracking-wide">{COMPANY.signer}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// Inline style constants — explicit pixel borders that survive both screen
// rendering and the browser print pipeline (some engines drop sub-pixel
// borders or strip Tailwind's default border-color when going to PDF).
const thStyle: React.CSSProperties = {
  border: '1px solid #000',
  padding: '6px 8px',
  textAlign: 'center',
  fontWeight: 700,
}
const tdStyle: React.CSSProperties = {
  border: '1px solid #000',
  padding: '4px 8px',
  verticalAlign: 'middle',
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td className="px-2 py-1 text-right font-semibold text-gray-700">{label}</td>
      <td className="px-2 py-1 text-right tabular-nums">{value}</td>
    </tr>
  )
}
