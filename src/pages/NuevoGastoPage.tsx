import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  Upload,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ScanLine,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useGastosStore } from '../stores/gastos-store';
import { ocrReceipt } from '../lib/sheets-api';
import type { GastoTipo, MetodoPago } from '../stores/gastos-store';
import type { OcrLineItem } from '../lib/sheets-api';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';

// ── Empty line item ───────────────────────────────────────────────────────────

function emptyLine(): OcrLineItem {
  return { part_number: '', description: '', qty: 1, unit_price: 0, subtotal: 0 };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NuevoGastoPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const { saveGasto, saving } = useGastosStore();

  // ── Form state
  const [tipo, setTipo] = useState<GastoTipo>('Refaccion');
  const [proveedor, setProveedor] = useState('');
  const [rfcProveedor, setRfcProveedor] = useState('');
  const [folioFactura, setFolioFactura] = useState('');
  const [subtotal, setSubtotal] = useState(0);
  const [iva, setIva] = useState(0);
  const [total, setTotal] = useState(0);
  const [unidad, setUnidad] = useState('');
  const [otId, setOtId] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('Efectivo');
  const [lineItems, setLineItems] = useState<OcrLineItem[]>([emptyLine()]);
  const [imageUrl] = useState('');

  // ── OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrDone, setOcrDone] = useState(false);

  // ── Submit state
  const [submitDone, setSubmitDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // ── Recalc total when subtotal or IVA changes ─────────────────────────────

  function handleSubtotalChange(val: number) {
    setSubtotal(val);
    const calculatedIva = parseFloat((val * 0.16).toFixed(2));
    setIva(calculatedIva);
    setTotal(parseFloat((val + calculatedIva).toFixed(2)));
  }

  // ── OCR ───────────────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setOcrLoading(true);
    setOcrError(null);
    setOcrDone(false);
    try {
      const result = await ocrReceipt(file);
      setProveedor(result.proveedor || '');
      setRfcProveedor(result.rfc_proveedor || '');
      setFolioFactura(result.folio_factura || '');
      setSubtotal(result.subtotal || 0);
      setIva(result.iva || 0);
      setTotal(result.total || 0);
      if (result.tipo) setTipo(result.tipo as GastoTipo);
      if (result.line_items?.length > 0) {
        setLineItems(result.line_items);
      }
      setOcrDone(true);
    } catch (err: unknown) {
      setOcrError(err instanceof Error ? err.message : 'Error al leer el recibo');
    } finally {
      setOcrLoading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  // ── Line item helpers ─────────────────────────────────────────────────────

  function updateLine(index: number, patch: Partial<OcrLineItem>) {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, ...patch };
        updated.subtotal = parseFloat((updated.qty * updated.unit_price).toFixed(2));
        return updated;
      })
    );
  }

  function addLine() {
    setLineItems((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    try {
      await saveGasto({
        tipo,
        proveedor,
        rfc_proveedor: rfcProveedor,
        folio_factura: folioFactura,
        subtotal,
        iva,
        total,
        unidad,
        ot_id: otId,
        metodo_pago: metodoPago,
        imagen_url: imageUrl,
        solicitante: userName,
        line_items: lineItems.filter((l) => l.description.trim() !== ''),
      });
      setSubmitDone(true);
      setTimeout(() => navigate(-1), 1800);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (submitDone) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-up">
        <CheckCircle size={56} className="text-success" />
        <p className="text-xl font-semibold text-text">Gasto registrado</p>
        <p className="text-sm text-text-secondary">Regresando…</p>
      </div>
    );
  }

  const unitIds = EQUIPMENT_CATALOG.map((e) => e.unit_id);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col py-4 gap-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ChevronLeft size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-xl font-bold text-text">Nuevo Gasto</h1>
      </div>

      {/* ── OCR section ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
        <p className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
          <ScanLine size={16} /> Escanear Recibo / Factura
        </p>
        <div className="flex gap-3">
          {/* Camera */}
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex-1 flex flex-col items-center gap-1 border-2 border-dashed border-border rounded-lg py-4 text-text-secondary hover:border-amber transition-colors"
          >
            <Camera size={22} />
            <span className="text-xs">Cámara</span>
          </button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileInput}
          />

          {/* Gallery */}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex flex-col items-center gap-1 border-2 border-dashed border-border rounded-lg py-4 text-text-secondary hover:border-amber transition-colors"
          >
            <Upload size={22} />
            <span className="text-xs">Galería</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* OCR feedback */}
        {ocrLoading && (
          <div className="flex items-center gap-2 mt-3 text-sm text-text-secondary">
            <Loader2 size={16} className="animate-spin" />
            Leyendo recibo…
          </div>
        )}
        {ocrDone && !ocrLoading && (
          <div className="flex items-center gap-2 mt-3 text-sm text-success">
            <CheckCircle size={16} />
            Datos extraídos — revisa y corrige si es necesario
          </div>
        )}
        {ocrError && (
          <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
            <AlertCircle size={16} />
            {ocrError}
          </div>
        )}
      </div>

      {/* ── General info ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
        <p className="text-sm font-semibold text-text">Datos Generales</p>

        {/* Tipo */}
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as GastoTipo)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="Refaccion">Refacción</option>
            <option value="Combustible">Combustible</option>
            <option value="Servicio">Servicio</option>
            <option value="Otro">Otro</option>
          </select>
        </div>

        {/* Proveedor */}
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Proveedor</label>
          <input
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            placeholder="Nombre del proveedor"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            required
          />
        </div>

        {/* RFC */}
        <div>
          <label className="text-xs text-text-secondary mb-1 block">RFC Proveedor (opcional)</label>
          <input
            value={rfcProveedor}
            onChange={(e) => setRfcProveedor(e.target.value.toUpperCase())}
            placeholder="RFC-XXXXXX-XXX"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono"
          />
        </div>

        {/* Folio */}
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Folio / Factura (opcional)</label>
          <input
            value={folioFactura}
            onChange={(e) => setFolioFactura(e.target.value)}
            placeholder="A-04821"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm"
          />
        </div>

        {/* Unidad */}
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Unidad</label>
          <select
            value={unidad}
            onChange={(e) => setUnidad(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white"
            required
          >
            <option value="">Seleccionar unidad…</option>
            {unitIds.map((uid) => (
              <option key={uid} value={uid}>{uid}</option>
            ))}
          </select>
        </div>

        {/* OT (optional) */}
        <div>
          <label className="text-xs text-text-secondary mb-1 block">OT relacionada (opcional)</label>
          <input
            value={otId}
            onChange={(e) => setOtId(e.target.value.toUpperCase())}
            placeholder="OT-2026-044"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono"
          />
        </div>

        {/* Método de pago */}
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Método de Pago</label>
          <select
            value={metodoPago}
            onChange={(e) => setMetodoPago(e.target.value as MetodoPago)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="Efectivo">Efectivo</option>
            <option value="Transferencia">Transferencia</option>
            <option value="Tarjeta">Tarjeta</option>
          </select>
        </div>
      </div>

      {/* ── Totales ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
        <p className="text-sm font-semibold text-text">Totales</p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Subtotal</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={subtotal || ''}
              onChange={(e) => handleSubtotalChange(parseFloat(e.target.value) || 0)}
              placeholder="0.00"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">IVA 16%</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={iva || ''}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0;
                setIva(v);
                setTotal(parseFloat((subtotal + v).toFixed(2)));
              }}
              placeholder="0.00"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-text-secondary mb-1 block">Total</label>
            <div className="w-full border border-border rounded-lg px-3 py-2 text-sm font-semibold bg-gray-50">
              ${total.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Line items ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
        <p className="text-sm font-semibold text-text">Líneas del Recibo</p>

        {lineItems.map((item, i) => (
          <div key={i} className="border border-border rounded-lg p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary font-medium">Línea {i + 1}</span>
              {lineItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="text-red-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <input
              value={item.part_number}
              onChange={(e) => updateLine(i, { part_number: e.target.value })}
              placeholder="Número de parte (opcional)"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm font-mono"
            />
            <input
              value={item.description}
              onChange={(e) => updateLine(i, { description: e.target.value })}
              placeholder="Descripción *"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm"
              required
            />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Cant.</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={item.qty || ''}
                  onChange={(e) => updateLine(i, { qty: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-border rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Precio u.</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.unit_price || ''}
                  onChange={(e) => updateLine(i, { unit_price: parseFloat(e.target.value) || 0 })}
                  className="w-full border border-border rounded-lg px-2 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Subtotal</label>
                <div className="w-full border border-border rounded-lg px-2 py-2 text-sm bg-gray-50">
                  ${item.subtotal.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addLine}
          className="flex items-center gap-2 text-sm text-amber font-medium py-2"
        >
          <Plus size={16} /> Agregar línea
        </button>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {submitError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle size={16} />
          {submitError}
        </div>
      )}

      {/* ── Submit ───────────────────────────────────────────────────────── */}
      <button
        type="submit"
        disabled={saving}
        className="w-full bg-amber text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {saving ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Guardando…
          </>
        ) : (
          'Registrar Gasto'
        )}
      </button>
    </form>
  );
}
