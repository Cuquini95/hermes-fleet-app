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
import { ocrReceipt, importPartsFromQuote } from '../lib/sheets-api';
import type { GastoTipo, MetodoPago } from '../stores/gastos-store';
import type { OcrLineItem, PriceChange } from '../lib/sheets-api';
import { uploadPhoto } from '../lib/photo-upload';
import { useEquipmentList } from '../hooks/useEquipmentList';

// ── Empty line item ───────────────────────────────────────────────────────────

function emptyLine(): OcrLineItem {
  return { part_number: '', description: '', qty: 1, unit_price: 0, subtotal: 0 };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NuevoGastoPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();
  const { saveGasto, saving } = useGastosStore();

  // ── Form state
  const [tipo, setTipo] = useState<GastoTipo>('Refaccion');
  const [proveedor, setProveedor] = useState('');
  const [rfcProveedor, setRfcProveedor] = useState('');
  const [folioFactura, setFolioFactura] = useState('');
  const [subtotal, setSubtotal] = useState(0);
  const [iva, setIva] = useState(0);
  const [total, setTotal] = useState(0);
  // ── Unit mode
  const [unitMode, setUnitMode] = useState<'single' | 'multi'>('single');
  const [unidad, setUnidad] = useState('');
  const [splitEntries, setSplitEntries] = useState<{ unitId: string; amount: number }[]>([]);
  const [splitPickerValue, setSplitPickerValue] = useState('');
  const [otId, setOtId] = useState('');
  const [metodoPago, setMetodoPago] = useState<MetodoPago>('Efectivo');
  const [lineItems, setLineItems] = useState<OcrLineItem[]>([emptyLine()]);
  const [imageUrl, setImageUrl] = useState('');

  // ── OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrDone, setOcrDone] = useState(false);

  // ── Submit state
  const [submitDone, setSubmitDone] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);

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
      // Run OCR and photo upload in parallel — upload failure is non-blocking
      const [ocrResult, uploadResult] = await Promise.allSettled([
        ocrReceipt(file),
        uploadPhoto(file, 'receipts', `gastos/${Date.now()}`),
      ]);

      if (ocrResult.status === 'fulfilled') {
        const result = ocrResult.value;
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
      } else {
        const msg = ocrResult.reason instanceof Error ? ocrResult.reason.message : '';
        if (msg.includes('404') || msg.includes('Not Found')) {
          setOcrError('El servicio OCR aún no está activo en el servidor. Completa los datos manualmente.');
        } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) {
          setOcrError('Sin conexión al servidor. Completa los datos manualmente.');
        } else {
          setOcrError('No se pudo leer el recibo. Completa los datos manualmente.');
        }
      }

      // Save photo URL if upload succeeded (non-blocking — gasto saves even if upload failed)
      if (uploadResult.status === 'fulfilled') {
        setImageUrl(uploadResult.value);
      }
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

  // ── Split helpers ─────────────────────────────────────────────────────────

  function addSplitUnit(uid: string) {
    if (!uid || splitEntries.some((e) => e.unitId === uid)) return;
    setSplitEntries((prev) => {
      const count = prev.length + 1;
      const equal = parseFloat((total / count).toFixed(2));
      // Redistribute equally
      const updated = prev.map((e) => ({ ...e, amount: equal }));
      // Last entry absorbs rounding remainder
      const sumRest = equal * (count - 1);
      const last = parseFloat((total - sumRest).toFixed(2));
      return [...updated, { unitId: uid, amount: last }];
    });
    setSplitPickerValue('');
  }

  function removeSplitUnit(uid: string) {
    setSplitEntries((prev) => prev.filter((e) => e.unitId !== uid));
  }

  function updateSplitAmount(uid: string, amount: number) {
    setSplitEntries((prev) =>
      prev.map((e) => (e.unitId === uid ? { ...e, amount } : e))
    );
  }

  const splitSum = splitEntries.reduce((s, e) => s + e.amount, 0);
  const splitOk = splitEntries.length > 0 && Math.abs(splitSum - total) < 0.01;

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    const commonFields = {
      tipo,
      proveedor,
      rfc_proveedor: rfcProveedor,
      folio_factura: folioFactura,
      ot_id: otId,
      metodo_pago: metodoPago,
      imagen_url: imageUrl,
      solicitante: userName,
      line_items: lineItems.filter((l) => l.description.trim() !== ''),
    };

    try {
      if (unitMode === 'single') {
        await saveGasto({ ...commonFields, subtotal, iva, total, unidad });
      } else {
        for (const entry of splitEntries) {
          const proportion = total > 0 ? entry.amount / total : 1 / splitEntries.length;
          await saveGasto({
            ...commonFields,
            unidad: entry.unitId,
            total: entry.amount,
            subtotal: parseFloat((subtotal * proportion).toFixed(2)),
            iva: parseFloat((iva * proportion).toFixed(2)),
          });
        }
      }

      // Auto-import parts into catalog when saving a Refaccion quote.
      // Returns any price changes so we can show an alert before navigating away.
      if (tipo === 'Refaccion' && commonFields.line_items.length > 0) {
        const changes = await importPartsFromQuote(
          proveedor,
          commonFields.line_items.map((l) => ({
            part_number: l.part_number,
            description: l.description,
            unit_price: l.unit_price,
          }))
        );
        if (changes.length > 0) {
          setPriceChanges(changes);
          // Give the user time to read the alert before navigating
          setSubmitDone(true);
          setTimeout(() => navigate(-1), 6000);
          return;
        }
      }

      setSubmitDone(true);
      setTimeout(() => navigate(-1), 1800);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (submitDone) {
    const count = unitMode === 'multi' ? splitEntries.length : 1;
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4 animate-fade-up">
        <CheckCircle size={56} className="text-success" />
        <p className="text-xl font-semibold text-text">
          {count === 1 ? 'Gasto registrado' : `${count} gastos registrados`}
        </p>

        {/* ── Price change alert ──────────────────────────────────────── */}
        {priceChanges.length > 0 && (
          <div className="w-full max-w-sm bg-amber-50 border border-amber-300 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={18} className="text-amber-600 shrink-0" />
              <p className="text-sm font-bold text-amber-800">
                ⚠️ Cambio de precios detectado
              </p>
            </div>
            <p className="text-xs text-amber-700 mb-3">
              Los siguientes productos tienen un precio diferente al registrado anteriormente.
              Verifica si te lo dieron al precio correcto.
            </p>
            <div className="flex flex-col gap-2">
              {priceChanges.map((ch) => {
                const up = ch.pct_change > 0;
                return (
                  <div key={ch.part_number} className="bg-white rounded-lg border border-amber-200 p-3 text-xs">
                    <p className="font-semibold text-text">{ch.part_number}</p>
                    <p className="text-text-secondary truncate">{ch.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-text-secondary line-through">
                        ${ch.old_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-text font-medium">
                        ${ch.new_price.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                      <span className={`font-bold ${up ? 'text-red-600' : 'text-green-600'}`}>
                        {up ? '▲' : '▼'} {Math.abs(ch.pct_change)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-amber-600 mt-3 text-center">
              Se envió una alerta por WhatsApp · Regresando en unos segundos…
            </p>
          </div>
        )}

        {priceChanges.length === 0 && (
          <p className="text-sm text-text-secondary">Regresando…</p>
        )}
      </div>
    );
  }

  const unitIds = ['FLOTA', ...equipment.map((e) => e.unit_id)];

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
            <span className="text-xs">Galería / PDF</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
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

        {/* Unidad(es) */}
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Unidad(es)</label>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setUnitMode('single')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                unitMode === 'single' ? 'bg-amber text-white' : 'bg-white border border-border text-text-secondary'
              }`}
            >
              Una unidad
            </button>
            <button
              type="button"
              onClick={() => setUnitMode('multi')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                unitMode === 'multi' ? 'bg-amber text-white' : 'bg-white border border-border text-text-secondary'
              }`}
            >
              Múltiples · Flota
            </button>
          </div>

          {unitMode === 'single' ? (
            <select
              value={unidad}
              onChange={(e) => setUnidad(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white"
              required={unitMode === 'single'}
            >
              <option value="">Seleccionar unidad…</option>
              {unitIds.map((uid) => (
                <option key={uid} value={uid}>{uid === 'FLOTA' ? '── FLOTA (global) ──' : uid}</option>
              ))}
            </select>
          ) : (
            <div className="bg-amber/5 border border-amber/30 rounded-xl p-3 flex flex-col gap-2">
              <p className="text-xs font-semibold text-amber-800">
                Distribución — Total: ${total.toFixed(2)}
              </p>

              {splitEntries.map((entry) => (
                <div key={entry.unitId} className="flex items-center gap-2">
                  <span className="flex-1 bg-white border border-border rounded-lg px-3 py-1.5 text-sm font-semibold text-text">
                    {entry.unitId}
                  </span>
                  <span className="text-xs text-text-secondary">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={entry.amount || ''}
                    onChange={(e) => updateSplitAmount(entry.unitId, parseFloat(e.target.value) || 0)}
                    className="w-24 border border-border rounded-lg px-2 py-1.5 text-sm font-semibold text-right"
                  />
                  <button
                    type="button"
                    onClick={() => removeSplitUnit(entry.unitId)}
                    className="w-7 h-7 rounded-full bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}

              {/* Add unit picker */}
              <select
                value={splitPickerValue}
                onChange={(e) => addSplitUnit(e.target.value)}
                className="w-full border border-dashed border-border rounded-lg px-3 py-1.5 text-sm text-text-secondary bg-white"
              >
                <option value="">+ Agregar unidad…</option>
                {unitIds
                  .filter((uid) => !splitEntries.some((e) => e.unitId === uid))
                  .map((uid) => (
                    <option key={uid} value={uid}>{uid === 'FLOTA' ? '── FLOTA (global) ──' : uid}</option>
                  ))}
              </select>

              {/* Running total */}
              {splitEntries.length > 0 && (
                <div className="flex justify-between items-center pt-1 border-t border-amber/20">
                  <span className="text-xs text-amber-800">Distribuido</span>
                  <span className={`text-xs font-bold ${splitOk ? 'text-green-600' : 'text-red-500'}`}>
                    ${splitSum.toFixed(2)} {splitOk ? '✓' : `— faltan $${(total - splitSum).toFixed(2)}`}
                  </span>
                </div>
              )}
            </div>
          )}
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
        disabled={saving || (unitMode === 'multi' && !splitOk)}
        className="w-full bg-amber text-white font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {saving ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Guardando…
          </>
        ) : unitMode === 'multi' ? (
          `Registrar ${splitEntries.length} gastos`
        ) : (
          'Registrar Gasto'
        )}
      </button>
    </form>
  );
}
