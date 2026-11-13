/**
 * @fileoverview Monolithic by design (> 400 LOC).
 * Parts-orders workflow page — one cohesive list+detail flow with shared inventory lookup state.
 */
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  Loader2,
  PackageSearch,
  AlertCircle,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowRight,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useCartStore, type CartItem } from '../stores/cart-store';
import { PurchaseApiError, purchaseRequests, purchaseWrite, type PurchaseRequestLine } from '../lib/purchasing-api';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { useCatalogoStore } from '../stores/catalogo-store';
import PanamaSourceRecords from '../components/workshop/PanamaSourceRecords';

const URGENCIA_CONFIG = {
  Normal:  { color: '#16A34A', bg: '#F0FDF4' },
  Urgente: { color: '#D97706', bg: '#FFFBEB' },
  Crítico: { color: '#DC2626', bg: '#FEF2F2' },
} as const;

// ── Manual part form ─────────────────────────────────────────────────────────
interface ManualForm {
  part_number: string;
  description: string;
  quantity: string;
  unit_price: string;
  equipment: string;
  urgencia: 'Normal' | 'Urgente' | 'Crítico';
  notes: string;
}

const emptyManual = (): ManualForm => ({
  part_number: '',
  description: '',
  quantity: '1',
  unit_price: '0',
  equipment: '',
  urgencia: 'Normal',
  notes: '',
});

type Tab = 'carrito' | 'pendientes' | 'historial';

// ════════════════════════════════════════════════════════════════════════════
export default function PedidosPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const isPanama = useAuthStore((s) => s.project === 'tmf-panama');
  const canReceive = useAuthStore((s) => s.project === 'tmf-panama' && s.canReceivePurchases);
  const equipment = useEquipmentList();
  const { items, removeItem, updateItem, clearCart } = useCartStore();

  const isJT = role === 'jefe_taller';
  const isGerencia = role === 'gerencia';

  const { fetchCatalogo, fetched: catalogFetched } = useCatalogoStore();

  const [tab, setTab] = useState<Tab>(isJT ? 'carrito' : isGerencia ? 'pendientes' : 'historial');
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState<ManualForm>(emptyManual());
  const [manualErrors, setManualErrors] = useState<Partial<ManualForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState('');
  const submitLock = useRef(false);
  const historialQuery = useRef<AbortController | null>(null);
  const [historial, setHistorial] = useState<PurchaseRequestLine[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(true);
  const [historialError, setHistorialError] = useState<'source' | 'access' | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const visibleRows = tab === 'pendientes' ? historial.filter((row) => row.estado !== 'Completado') : historial;

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  // ── Load historial ────────────────────────────────────────────────────────
  async function loadHistorial() {
    historialQuery.current?.abort();
    const controller = new AbortController();
    historialQuery.current = controller;
    setLoadingHistorial(true);
    setHistorialError(null);
    try {
      const { items: rows } = await purchaseRequests(controller.signal);
      if (controller.signal.aborted) return;
      setHistorial(rows);
    } catch (error) {
      if (controller.signal.aborted) return;
      setHistorialError(error instanceof PurchaseApiError && [401, 403].includes(error.status) ? 'access' : 'source');
      setHistorial([]);
    } finally {
      if (!controller.signal.aborted) setLoadingHistorial(false);
    }
  }

  // Auto-load historial on mount (Gerencia starts on historial tab directly)
  useEffect(() => {
    void loadHistorial();
    if (isJT && !catalogFetched) void fetchCatalogo();
    return () => historialQuery.current?.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTabChange(t: Tab) {
    setTab(t);
    if (t !== 'carrito') void loadHistorial();
  }

  // ── Manual part validation ────────────────────────────────────────────────
  function validateManual(): boolean {
    const e: Partial<ManualForm> = {};
    if (!manual.part_number.trim()) e.part_number = 'Requerido';
    if (!manual.description.trim()) e.description = 'Requerido';
    if (!manual.quantity || isNaN(Number(manual.quantity)) || Number(manual.quantity) < 0.001) e.quantity = 'Mínimo 0.001';
    setManualErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleAddManual() {
    if (!validateManual()) return;
    useCartStore.getState().addItem({
      part_number: manual.part_number.trim().toUpperCase(),
      description: manual.description.trim(),
      quantity: Number(manual.quantity),
      unit_price: Number(manual.unit_price) || 0,
      equipment: manual.equipment,
      urgencia: manual.urgencia,
      notes: manual.notes,
      isManual: true,
      source: 'Manual',
    });
    setManual(emptyManual());
    setManualErrors({});
    setShowManual(false);
  }

  async function handleSubmit() {
    if (items.length === 0 || submitLock.current) return;
    const missingUnit = items.find((item) => !item.equipment);
    if (missingUnit) {
      setExpandedItem(missingUnit.cartId);
      setSubmitError('Selecciona la unidad de cada partida antes de enviar.');
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      const { folio } = await purchaseWrite<{ folio: string }>('request-submit', { items });
      clearCart();
      setSubmitted(folio);
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'No se confirmó el envío. Reintenta con las mismas partidas.');
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  // ── SUCCESS screen ────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-6 animate-fade-up">
        <CheckCircle2 size={64} color="#16A34A" />
        <h2 className="text-2xl font-bold text-text text-center">Pedido Enviado</h2>
        <p className="text-text-secondary text-center text-sm">
          Folio <span className="font-mono font-semibold">{submitted}</span>. Gerencia puede consultarlo en Pedidos Pendientes.
        </p>
        <button
          onClick={() => { setSubmitted(''); navigate('/workshop'); }}
          className="w-full py-3 rounded-xl font-semibold text-white"
          style={{ backgroundColor: '#162252' }}
        >
          Volver al Inicio
        </button>
        <button
          onClick={() => { setSubmitted(''); handleTabChange('historial'); }}
          className="w-full py-3 rounded-xl font-semibold border"
          style={{ borderColor: '#162252', color: '#162252' }}
        >
          Ver Historial
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col py-4 animate-fade-up">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <ShoppingCart size={24} color="#162252" />
        <h1 className="text-xl font-bold text-text">Pedidos de Refacciones</h1>
      </div>
      {isPanama && isGerencia && <Link to="/admin/ordenes-compra" className="mb-4 inline-flex min-h-11 items-center rounded-lg border border-slate-400 bg-white px-4 text-sm font-semibold text-[#162252]">Órdenes de compra</Link>}
      {canReceive && <Link to="/panama/recepciones" className="mb-4 inline-flex min-h-11 items-center rounded-lg border border-slate-400 bg-white px-4 text-sm font-semibold text-[#162252]">Recepciones de compras</Link>}

      {/* ── Tabs ── */}
      <div className="flex mb-5 rounded-xl overflow-hidden border border-border">
        {isJT && (
          <button
            onClick={() => handleTabChange('carrito')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: tab === 'carrito' ? '#162252' : '#FFFFFF',
              color: tab === 'carrito' ? '#FFFFFF' : '#6B7280',
            }}
          >
            <ShoppingCart size={15} />
            Carrito
            {items.length > 0 && (
              <span
                className="rounded-full text-xs px-1.5 py-0.5 font-bold"
                style={{
                  backgroundColor: tab === 'carrito' ? '#F59E0B' : '#162252',
                  color: '#FFFFFF',
                }}
              >
                {items.length}
              </span>
            )}
          </button>
        )}
        {isGerencia && (
          <button
            onClick={() => handleTabChange('pendientes')}
            className="flex-1 flex items-center justify-center px-2 py-2.5 text-sm font-semibold"
            style={{ backgroundColor: tab === 'pendientes' ? '#162252' : '#FFFFFF', color: tab === 'pendientes' ? '#FFFFFF' : '#6B7280' }}
          >
            Pedidos Pendientes
          </button>
        )}
        <button
          onClick={() => handleTabChange('historial')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors"
          style={{
            backgroundColor: tab === 'historial' ? '#162252' : '#FFFFFF',
            color: tab === 'historial' ? '#FFFFFF' : '#6B7280',
          }}
        >
          <ClipboardList size={15} />
          Historial
        </button>
      </div>

      {/* ════════════════════ CARRITO TAB ════════════════════ */}
      {tab === 'carrito' && isJT && (
        <fieldset disabled={submitting} className="flex min-w-0 flex-col gap-4">

          {/* Empty carrito */}
          {items.length === 0 && !showManual && (
            <div className="flex flex-col items-center gap-4 py-10">
              <PackageSearch size={48} color="#9CA3AF" />
              <p className="text-text-secondary text-center">
                Tu carrito está vacío.<br />
                Busca refacciones en <strong>Partes</strong> y agrega las que necesitas.
              </p>
              <button
                onClick={() => navigate('/parts')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white"
                style={{ backgroundColor: '#162252' }}
              >
                <Search size={16} />
                Ir a Partes
              </button>
              <button
                onClick={() => setShowManual(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold border"
                style={{ borderColor: '#162252', color: '#162252' }}
              >
                <Plus size={16} />
                Agregar parte manual
              </button>
            </div>
          )}

          {/* Cart items */}
          {items.map((item) => (
            <CartItemCard
              key={item.cartId}
              item={item}
              expanded={expandedItem === item.cartId}
              onToggle={() => setExpandedItem(expandedItem === item.cartId ? null : item.cartId)}
              onUpdate={(updates) => updateItem(item.cartId, updates)}
              onRemove={() => removeItem(item.cartId)}
              unitIds={equipment.map((e) => e.unit_id)}
            />
          ))}

          {/* Add manual part toggle */}
          {items.length > 0 && !showManual && (
            <button
              onClick={() => setShowManual(true)}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border-dashed border-2 text-sm font-medium transition-colors"
              style={{ borderColor: '#162252', color: '#162252' }}
            >
              <Plus size={16} />
              Agregar parte manual
            </button>
          )}

          {/* Manual entry form */}
          {showManual && (
            <ManualPartForm
              form={manual}
              errors={manualErrors}
              onChange={(f) => setManual(f)}
              onAdd={handleAddManual}
              onCancel={() => { setShowManual(false); setManual(emptyManual()); setManualErrors({}); }}
              unitIds={equipment.map((e) => e.unit_id)}
            />
          )}

          {/* Order summary + submit */}
          {items.length > 0 && (
            <div className="mt-2">
              {/* Summary */}
              <div
                className="rounded-xl p-4 mb-3"
                style={{ backgroundColor: '#F1F5F9', border: '1px solid #E5E7EB' }}
              >
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary">Total partes:</span>
                  <span className="font-semibold text-text">{totalItems} piezas</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-secondary">Líneas:</span>
                  <span className="font-semibold text-text">{items.length}</span>
                </div>
                <div className="flex justify-between text-base font-bold mt-2 pt-2 border-t border-border">
                  <span className="text-text">Total estimado:</span>
                  <span style={{ color: '#162252' }}>${totalPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Crítico warning */}
              {items.some((i) => i.urgencia === 'Crítico') && (
                <div
                  className="flex items-center gap-2 p-3 rounded-xl mb-3"
                  style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
                >
                  <AlertCircle size={16} color="#DC2626" />
                  <p className="text-xs text-red-700 font-medium">
                    Hay partes marcadas como Crítico — notifica al Supervisor inmediatamente.
                  </p>
                </div>
              )}

              {submitError && (
                <div
                  className="flex items-center gap-2 p-3 rounded-xl mb-3"
                  style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
                >
                  <WifiOff size={16} color="#DC2626" />
                  <p className="text-xs text-red-700 font-medium">
                    {submitError}
                  </p>
                </div>
              )}

              <button
                disabled={submitting}
                onClick={handleSubmit}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white text-base"
                style={{ backgroundColor: '#162252' }}
              >
                {submitting ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <Send size={18} />
                    {submitError ? 'Reintentar envío' : `Enviar Pedido (${items.length} ${items.length === 1 ? 'parte' : 'partes'})`}
                  </>
                )}
              </button>
            </div>
          )}
        </fieldset>
      )}

      {/* ════════════════════ HISTORIAL TAB ════════════════════ */}
      {tab !== 'carrito' && (
        <div className="flex flex-col gap-3">
          {loadingHistorial && (
            <div className="flex justify-center py-10">
              <Loader2 size={28} className="animate-spin" style={{ color: '#162252' }} />
            </div>
          )}

          {!loadingHistorial && historialError && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p role="alert" className="text-sm text-amber-900">
                  {historialError === 'access' ? 'Tu cuenta no pudo abrir esta consulta.' : 'No se pudieron consultar los pedidos de Hermes.'}
                </p>
                <button type="button" onClick={() => void loadHistorial()} className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-[#162252] px-3 text-sm font-semibold text-white">
                  <RefreshCw size={15} /> Reintentar
                </button>
              </div>
            </>
          )}

          {/* Empty (loaded successfully but zero rows) */}
          {!loadingHistorial && !historialError && visibleRows.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-10">
              <ClipboardList size={48} color="#9CA3AF" />
              <p className="text-text-secondary text-center text-sm">
                {isPanama ? 'Sin pedidos de Hermes en esta vista.' : 'No hay pedidos registrados aún.'}
              </p>
              <button
                onClick={() => loadHistorial()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium"
                style={{ borderColor: '#162252', color: '#162252' }}
              >
                <RefreshCw size={14} />
                Actualizar
              </button>
            </div>
          )}

          {visibleRows.map((row) => (
            <PedidoRowCard
              key={row.id}
              row={row}
              isGerencia={isGerencia}
              onStatusChange={() => loadHistorial()}
            />
          ))}
          {isPanama && !loadingHistorial && historialError !== 'access' && <PanamaSourceRecords source="purchases" />}

          {/* Refresh at bottom when results are showing */}
          {!loadingHistorial && !historialError && visibleRows.length > 0 && (
            <button
              onClick={() => loadHistorial()}
              className="flex items-center justify-center gap-1.5 text-center text-sm py-2"
              style={{ color: '#2563EB' }}
            >
              <RefreshCw size={13} />
              Actualizar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── CartItemCard ─────────────────────────────────────────────────────────────
function CartItemCard({
  item,
  expanded,
  onToggle,
  onUpdate,
  onRemove,
  unitIds,
}: {
  item: CartItem;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (u: Partial<CartItem>) => void;
  onRemove: () => void;
  unitIds: string[];
}) {
  const urgCfg = URGENCIA_CONFIG[item.urgencia] ?? URGENCIA_CONFIG.Normal;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Collapsed header */}
      <div className="flex items-center gap-3 p-3">
        {/* Urgencia dot */}
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: urgCfg.color }}
        />
        <div className="flex-1 min-w-0">
          <p className="font-mono text-sm font-semibold text-amber truncate">{item.part_number}</p>
          <p className="text-xs text-text-secondary truncate">{item.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-bold text-text">×{item.quantity}</span>
          <button onClick={onToggle} aria-label={`Editar partida ${item.part_number}`} className="p-1">
            {expanded ? <ChevronUp size={16} color="#6B7280" /> : <ChevronDown size={16} color="#6B7280" />}
          </button>
          <button onClick={onRemove} aria-label={`Quitar partida ${item.part_number}`} className="p-1">
            <Trash2 size={16} color="#DC2626" />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 flex flex-col gap-3">
          {/* Equipo */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Equipo / Unidad</label>
            <select
              aria-label={`Unidad ${item.part_number}`}
              value={item.equipment}
              onChange={(e) => onUpdate({ equipment: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text bg-white"
            >
              <option value="">Sin asignar</option>
              {unitIds.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* Qty + Urgencia */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Cantidad</label>
              <input
                type="number"
                min="0.001"
                step="0.001"
                aria-label={`Cantidad ${item.part_number}`}
                value={item.quantity}
                onChange={(e) => onUpdate({ quantity: Number(e.target.value) })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Urgencia</label>
              <select
                value={item.urgencia}
                onChange={(e) => onUpdate({ urgencia: e.target.value as CartItem['urgencia'] })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text bg-white"
              >
                <option>Normal</option>
                <option>Urgente</option>
                <option>Crítico</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1">Notas</label>
            <input
              type="text"
              value={item.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Número de avería, referencia, etc."
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-text bg-white"
            />
          </div>

          {/* Price row */}
          <div className="flex justify-between text-sm pt-1 border-t border-border">
            <span className="text-text-secondary">
              {item.isManual ? '📝 Parte manual' : `📦 ${item.source}`}
            </span>
            <span className="font-bold text-text">
              ${(item.quantity * item.unit_price).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ManualPartForm ───────────────────────────────────────────────────────────
function ManualPartForm({
  form,
  errors,
  onChange,
  onAdd,
  onCancel,
  unitIds,
}: {
  form: ManualForm;
  errors: Partial<ManualForm>;
  onChange: (f: ManualForm) => void;
  onAdd: () => void;
  onCancel: () => void;
  unitIds: string[];
}) {
  const { search: searchCatalog } = useCatalogoStore();
  const [suggestions, setSuggestions] = useState<ReturnType<typeof searchCatalog>>([]);

  const f = (field: keyof ManualForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [field]: e.target.value });

  function handleSearchInput(value: string) {
    onChange({ ...form, description: value });
    setSuggestions(value.length >= 2 ? searchCatalog(value) : []);
  }

  function handlePartNumberInput(value: string) {
    onChange({ ...form, part_number: value });
    setSuggestions(value.length >= 2 ? searchCatalog(value) : []);
  }

  function applySuggestion(s: ReturnType<typeof searchCatalog>[0]) {
    onChange({
      ...form,
      part_number: s.clave.includes('_') ? '' : s.clave, // clave is PN if no underscores
      description: s.descripcion,
      unit_price:  s.precio > 0 ? String(s.precio) : form.unit_price,
    });
    setSuggestions([]);
  }

  return (
    <div
      className="rounded-xl border-2 p-4 flex flex-col gap-3 animate-fade-up"
      style={{ borderColor: '#2563EB', backgroundColor: '#EFF6FF' }}
    >
      <p className="font-semibold text-sm" style={{ color: '#1E3A8A' }}>
        ➕ Agregar parte manualmente
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">N° de Parte *</label>
          <input
            type="text"
            aria-label="Número de parte manual"
            value={form.part_number}
            onChange={(e) => handlePartNumberInput(e.target.value)}
            placeholder="Ej: 6745-11-3102"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          />
          {errors.part_number && <p className="text-xs text-red-500 mt-0.5">{errors.part_number}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Cantidad *</label>
          <input
            type="number"
            min="0.001"
            step="0.001"
            aria-label="Cantidad manual"
            value={form.quantity}
            onChange={f('quantity')}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          />
          {errors.quantity && <p className="text-xs text-red-500 mt-0.5">{errors.quantity}</p>}
        </div>
      </div>

      <div className="relative">
        <label className="block text-xs font-semibold text-text-secondary mb-1">Descripción *</label>
        <input
          type="text"
          aria-label="Descripción manual"
          value={form.description}
          onChange={(e) => handleSearchInput(e.target.value)}
          placeholder="Nombre o descripción de la parte"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          autoComplete="off"
        />
        {errors.description && <p className="text-xs text-red-500 mt-0.5">{errors.description}</p>}

        {/* Catalog suggestions dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s.clave}
                type="button"
                onMouseDown={() => applySuggestion(s)}
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="text-xs font-semibold text-text leading-tight">{s.descripcion}</p>
                    {!s.clave.includes('_') && (
                      <p className="text-xs text-blue-600 font-mono">{s.clave}</p>
                    )}
                    <p className="text-xs text-text-secondary">{s.proveedor}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-bold text-green-600">${s.precio.toFixed(2)}</p>
                    {s.precioMin !== s.precioMax && (
                      <p className="text-xs text-gray-400">${s.precioMin.toFixed(0)}–${s.precioMax.toFixed(0)}</p>
                    )}
                    <p className="text-xs text-gray-400">×{s.vecesComprado}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Precio Unit. ($)</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.unit_price}
            onChange={f('unit_price')}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Urgencia</label>
          <select
            value={form.urgencia}
            onChange={f('urgencia')}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          >
            <option>Normal</option>
            <option>Urgente</option>
            <option>Crítico</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">Equipo / Unidad</label>
        <select
          aria-label="Unidad manual"
          value={form.equipment}
          onChange={f('equipment')}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
        >
          <option value="">Sin asignar</option>
          {unitIds.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">Notas</label>
        <input
          type="text"
          value={form.notes}
          onChange={f('notes')}
          placeholder="Referencia, avería relacionada..."
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onAdd}
          className="flex-1 py-2.5 rounded-xl font-semibold text-white text-sm"
          style={{ backgroundColor: '#162252' }}
        >
          Agregar al carrito
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 rounded-xl font-semibold text-sm border"
          style={{ borderColor: '#D1D5DB', color: '#6B7280' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Status flow config ────────────────────────────────────────────────────────
const STATUS_NEXT: Record<string, string | null> = {
  Pendiente:  'Pedido',
  Pedido:     'Completado',
  Completado: null,
};

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  Pendiente:  { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  Pedido:     { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  Completado: { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
};

const STATUS_LABEL: Record<string, string> = {
  Pendiente:  'Marcar como Pedido',
  Pedido:     'Marcar Completado',
  Completado: '',
};

// ── PedidoRowCard (Historial / Gerencia view) ────────────────────────────────
function PedidoRowCard({
  row,
  isGerencia,
  onStatusChange,
}: {
  row: PurchaseRequestLine;
  isGerencia: boolean;
  onStatusChange: () => Promise<void>;
}) {
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const updateLock = useRef(false);
  const urgCfg = (URGENCIA_CONFIG as Record<string, { color: string; bg: string }>)[row.urgencia] ?? URGENCIA_CONFIG.Normal;
  const sCfg = STATUS_STYLE[row.estado] ?? STATUS_STYLE.Pendiente ?? { color: '#000', bg: '#fff', border: '#ccc' };
  const nextStatus = STATUS_NEXT[row.estado] ?? null;

  async function handleAdvance() {
    if (!nextStatus || updateLock.current || row.ocFolio) return;
    updateLock.current = true;
    setUpdating(true);
    setUpdateError('');
    try {
      await purchaseWrite('request-status', { id: row.id, version: row.version, status: nextStatus });
      await onStatusChange();
    } catch (cause) {
      setUpdateError(cause instanceof Error ? cause.message : 'No se confirmó el cambio de estado.');
    } finally {
      updateLock.current = false;
      setUpdating(false);
    }
  }

  return (
    <div
      className="bg-white rounded-xl shadow-sm overflow-hidden"
      style={{ border: `1.5px solid ${sCfg.border}` }}
    >
      {/* Status bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{ backgroundColor: sCfg.bg }}
      >
        <span className="text-xs font-bold" style={{ color: sCfg.color }}>
          {row.estado}
        </span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color: urgCfg.color, backgroundColor: urgCfg.bg }}>
          {row.urgencia}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="mb-2">
          <p className="font-mono text-sm font-semibold text-amber">{row.partNum}</p>
          <p className="text-sm text-text font-medium">{row.descripcion}</p>
          <p className="text-xs text-text-secondary mt-0.5">
            {row.pedidoId} · {row.fecha} · {row.solicitante}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary mb-3">
          {row.equipo && <span>📍 {row.equipo}</span>}
          <span>×{row.cantidad}</span>
          {row.total && <span className="font-semibold text-text">${row.total}</span>}
          {row.fuente && <span>{row.fuente}</span>}
        </div>
        {row.notas && <p className="text-xs text-text-secondary mb-3 italic">{row.notas}</p>}

        {updateError && <p role="alert" className="mb-2 text-xs text-red-700">{updateError}</p>}
        {row.ocFolio && (isGerencia ? (
          <Link className="block py-2 text-sm font-semibold text-blue-800" to={`/admin/ordenes-compra/${encodeURIComponent(row.ocFolio)}`}>
            Ver OC {row.ocFolio}
          </Link>
        ) : <p className="py-2 text-sm text-text-secondary">OC {row.ocFolio}</p>)}
        {isGerencia && nextStatus && !row.ocFolio && (
          <Link className="block rounded-lg bg-slate-900 px-3 py-2 mb-2 text-center text-sm font-semibold text-white" to={`/admin/ordenes-compra?partida=${encodeURIComponent(row.id)}`}>
            Convertir a OC
          </Link>
        )}
        {isGerencia && nextStatus && !row.ocFolio && (
          <button
            onClick={handleAdvance}
            disabled={updating}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-opacity"
            style={{
              backgroundColor: STATUS_STYLE[nextStatus]?.bg ?? '#F1F5F9',
              color: STATUS_STYLE[nextStatus]?.color ?? '#162252',
              border: `1.5px solid ${STATUS_STYLE[nextStatus]?.border ?? '#E5E7EB'}`,
              opacity: updating ? 0.6 : 1,
            }}
          >
            {updating ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <>
                <ArrowRight size={15} />
                {STATUS_LABEL[row.estado]}
              </>
            )}
          </button>
        )}

        {/* Completado — no further action */}
        {isGerencia && row.estado === 'Completado' && (
          <div className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold" style={{ color: '#16A34A' }}>
            <CheckCircle2 size={14} />
            Pedido completado
          </div>
        )}
      </div>
    </div>
  );
}
