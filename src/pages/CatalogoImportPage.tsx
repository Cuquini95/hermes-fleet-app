import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Upload,
  Camera,
  ScanLine,
  Loader2,
  AlertCircle,
  CheckCircle,
  Trash2,
  PackagePlus,
} from 'lucide-react';
import { ocrReceipt } from '../lib/sheets-api';
import { importPartsFromQuote } from '../lib/sheets-api';
import type { OcrLineItem, PriceChange } from '../lib/sheets-api';

// ── helpers ───────────────────────────────────────────────────────────────────

function emptyLine(): OcrLineItem {
  return { part_number: '', description: '', qty: 1, unit_price: 0, subtotal: 0 };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CatalogoImportPage() {
  const navigate = useNavigate();

  // ── form state
  const [supplier, setSupplier] = useState('');
  const [lineItems, setLineItems] = useState<OcrLineItem[]>([emptyLine()]);

  // ── OCR state
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrDone, setOcrDone] = useState(false);

  // ── import state
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);
  const [importedCount, setImportedCount] = useState(0);

  const fileRef   = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // ── OCR ───────────────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    setOcrLoading(true);
    setOcrError(null);
    setOcrDone(false);
    try {
      const result = await ocrReceipt(file);
      if (result.proveedor) setSupplier(result.proveedor);
      if (result.line_items?.length > 0) {
        setLineItems(result.line_items);
      }
      setOcrDone(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('404') || msg.includes('Not Found')) {
        setOcrError('El servicio OCR no está disponible. Completa los datos manualmente.');
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed')) {
        setOcrError('Sin conexión al servidor. Completa los datos manualmente.');
      } else {
        setOcrError('No se pudo leer el archivo. Completa los datos manualmente.');
      }
    } finally {
      setOcrLoading(false);
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
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

  function removeLine(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function addLine() {
    setLineItems((prev) => [...prev, emptyLine()]);
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async function handleImport() {
    setImportError(null);
    const validLines = lineItems.filter(
      (l) => l.part_number.trim() !== '' && l.description.trim() !== ''
    );
    if (validLines.length === 0) {
      setImportError('Agrega al menos una parte con número y descripción.');
      return;
    }
    if (!supplier.trim()) {
      setImportError('Indica el nombre del proveedor.');
      return;
    }

    setImporting(true);
    try {
      const changes = await importPartsFromQuote(
        supplier.trim(),
        validLines.map((l) => ({
          part_number: l.part_number,
          description: l.description,
          unit_price: l.unit_price,
        }))
      );
      setImportedCount(validLines.length);
      setPriceChanges(changes);
      setImportDone(true);
    } catch {
      setImportError('Error al importar. Intenta de nuevo.');
    } finally {
      setImporting(false);
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────

  if (importDone) {
    return (
      <div className="flex flex-col items-center py-10 gap-4 animate-fade-up">
        <CheckCircle size={56} className="text-success" />
        <p className="text-xl font-semibold text-text">
          {importedCount} {importedCount === 1 ? 'parte importada' : 'partes importadas'}
        </p>
        <p className="text-sm text-text-secondary">
          Disponibles ahora en la búsqueda de Partes.
        </p>

        {/* Price change alert */}
        {priceChanges.length > 0 && (
          <div className="w-full max-w-sm bg-amber-50 border border-amber-300 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={18} className="text-amber-600 shrink-0" />
              <p className="text-sm font-bold text-amber-800">⚠️ Cambio de precios detectado</p>
            </div>
            <p className="text-xs text-amber-700 mb-3">
              Estos productos tenían un precio diferente en el catálogo.
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
          </div>
        )}

        <div className="flex gap-3 mt-2">
          <button
            onClick={() => {
              setImportDone(false);
              setOcrDone(false);
              setSupplier('');
              setLineItems([emptyLine()]);
              setPriceChanges([]);
              setImportedCount(0);
            }}
            className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium text-text"
          >
            Importar otra
          </button>
          <button
            onClick={() => navigate('/parts')}
            className="px-5 py-2.5 rounded-xl bg-amber text-white text-sm font-medium"
          >
            Buscar partes
          </button>
        </div>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col py-4 gap-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={() => navigate(-1)} className="p-1 -ml-1">
          <ChevronLeft size={22} className="text-text-secondary" />
        </button>
        <h1 className="text-xl font-bold text-text">Importar al Catálogo</h1>
      </div>

      {/* ── Upload section ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
        <p className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
          <ScanLine size={16} className="text-amber" />
          Escanear Cotización / Lista de Precios
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={ocrLoading}
            className="flex-1 flex flex-col items-center gap-1 border-2 border-dashed border-border rounded-lg py-4 text-text-secondary hover:border-amber transition-colors disabled:opacity-50"
          >
            {ocrLoading ? <Loader2 size={22} className="animate-spin text-amber" /> : <Camera size={22} />}
            <span className="text-xs">Cámara</span>
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={ocrLoading}
            className="flex-1 flex flex-col items-center gap-1 border-2 border-dashed border-border rounded-lg py-4 text-text-secondary hover:border-amber transition-colors disabled:opacity-50"
          >
            {ocrLoading ? <Loader2 size={22} className="animate-spin text-amber" /> : <Upload size={22} />}
            <span className="text-xs">Galería / PDF</span>
          </button>
        </div>

        {/* hidden inputs */}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment"
          className="hidden" onChange={handleFileInput} />
        <input ref={fileRef} type="file" accept="image/*,application/pdf"
          className="hidden" onChange={handleFileInput} />

        {ocrLoading && (
          <p className="text-center text-xs text-amber mt-3 animate-pulse">
            Leyendo documento con IA…
          </p>
        )}
        {ocrDone && (
          <div className="flex items-center gap-2 mt-3 text-sm text-green-600">
            <CheckCircle size={16} />
            Datos extraídos — revisa y ajusta antes de importar
          </div>
        )}
        {ocrError && (
          <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
            <AlertCircle size={16} />
            {ocrError}
          </div>
        )}
      </div>

      {/* ── Supplier ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
        <label className="block text-xs font-semibold text-text-secondary mb-1">Proveedor *</label>
        <input
          type="text"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          placeholder="Nombre del proveedor o distribuidor"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text outline-none focus:border-amber"
        />
      </div>

      {/* ── Line items table ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-text">Partes / Productos</p>
          <span className="text-xs text-text-secondary">
            {lineItems.filter((l) => l.part_number.trim()).length} con número de parte
          </span>
        </div>

        <div className="flex flex-col gap-3">
          {lineItems.map((line, i) => (
            <div key={i} className="border border-border rounded-lg p-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-text-secondary mb-1">No. Parte</label>
                  <input
                    type="text"
                    value={line.part_number}
                    onChange={(e) => updateLine(i, { part_number: e.target.value })}
                    placeholder="AF25130M"
                    className="w-full border border-border rounded-lg px-2 py-1.5 text-xs text-text outline-none focus:border-amber font-mono"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs text-text-secondary mb-1">Precio unit.</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unit_price || ''}
                    onChange={(e) => updateLine(i, { unit_price: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full border border-border rounded-lg px-2 py-1.5 text-xs text-text outline-none focus:border-amber"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="self-end mb-0.5 p-1.5 text-red-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Descripción *</label>
                <input
                  type="text"
                  value={line.description}
                  onChange={(e) => updateLine(i, { description: e.target.value })}
                  placeholder="Filtro de aire primario"
                  className="w-full border border-border rounded-lg px-2 py-1.5 text-xs text-text outline-none focus:border-amber"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addLine}
          className="mt-3 w-full py-2 rounded-lg border border-dashed border-border text-xs text-text-secondary hover:border-amber hover:text-amber transition-colors"
        >
          + Agregar parte manualmente
        </button>
      </div>

      {/* ── Error ───────────────────────────────────────────────────────── */}
      {importError && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          <AlertCircle size={16} />
          {importError}
        </div>
      )}

      {/* ── Submit ──────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleImport}
        disabled={importing}
        className="w-full py-3.5 rounded-xl bg-amber text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {importing ? (
          <><Loader2 size={18} className="animate-spin" /> Importando…</>
        ) : (
          <><PackagePlus size={18} /> Importar al Catálogo</>
        )}
      </button>

      <p className="text-center text-xs text-text-secondary -mt-2 pb-4">
        Solo se importan partes con número de parte y descripción.
        Los precios se actualizan si ya existen en el catálogo.
      </p>
    </div>
  );
}
