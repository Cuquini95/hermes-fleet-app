import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { appendRow, readRange, updateCell, SHEET_TABS } from '../lib/sheets-api';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { mexicoDate, mexicoTime } from '../lib/date-utils';

// ── Sheet columns for Cotizaciones_Pendientes (matching actual Sheet headers) ─
// A(0)  Fecha
// B(1)  Part_Number
// C(2)  Descripcion
// D(3)  Equipo
// E(4)  Qty
// F(5)  Dealer          ← source / OEM / Manual
// G(6)  Status          ← Pendiente / Pedido / Completado
// H(7)  Precio_Recibido ← blank on submit; supplier fills later
// I(8)  Fecha_Respuesta ← blank on submit; supplier fills later
// J(9)  PEDIDO_ID       ← tracking reference
// K(10) Hora
// L(11) Solicitante
// M(12) Urgencia
// N(13) Notas
// O(14) Total

const URGENCIA_CONFIG = {
  Normal:  { color: '#16A34A', bg: '#F0FDF4' },
  Urgente: { color: '#D97706', bg: '#FFFBEB' },
  Crítico: { color: '#DC2626', bg: '#FEF2F2' },
} as const;

let _pedidoSeq = 1;
function newPedidoId(): string {
  const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `PED-${d}-${String(_pedidoSeq++).padStart(3, '0')}`;
}

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

// ── Submitted order row (read from sheet) ────────────────────────────────────
interface PedidoRow {
  id: string;
  pedidoId: string;
  fecha: string;
  hora: string;
  solicitante: string;
  partNum: string;
  descripcion: string;
  equipo: string;
  cantidad: string;
  precioUnit: string;
  total: string;
  urgencia: string;
  fuente: string;
  notas: string;
  estado: string;
}

type Tab = 'carrito' | 'historial';

// ════════════════════════════════════════════════════════════════════════════
export default function PedidosPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.role);
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();
  const { items, removeItem, updateItem, clearCart } = useCartStore();

  const isJT = role === 'jefe_taller';
  const isGerencia = role === 'gerencia';

  const [tab, setTab] = useState<Tab>(isGerencia ? 'historial' : 'carrito');
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState<ManualForm>(emptyManual());
  const [manualErrors, setManualErrors] = useState<Partial<ManualForm>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [historial, setHistorial] = useState<PedidoRow[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [historialLoaded, setHistorialLoaded] = useState(false);
  const [historialError, setHistorialError] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  // ── Load historial ────────────────────────────────────────────────────────
  async function loadHistorial(force = false) {
    if (historialLoaded && !force) return;
    setLoadingHistorial(true);
    setHistorialError(false);
    try {
      const rows = await readRange(SHEET_TABS.COTIZACIONES);
      if (rows.length === 0) { setHistorial([]); setHistorialLoaded(true); return; }

      // ── Discover column positions from the header row ──────────────────
      const headers = rows[0].map((h) => (h ?? '').toLowerCase().trim());
      const col = (keys: string[]): number =>
        keys.reduce((found, k) => found !== -1 ? found : headers.findIndex((h) => h.includes(k)), -1);

      const iDate   = col(['fecha']);
      const iPart   = col(['part_number', 'part number', 'part#', 'numero', 'número']);
      const iDesc   = col(['descripcion', 'descripción', 'description']);
      const iEquip  = col(['equipo', 'equipment', 'unidad']);
      const iQty    = col(['qty', 'cantidad', 'quantity']);
      const iDealer = col(['dealer', 'fuente', 'source', 'origen']);
      const iStatus = col(['status', 'estado', 'estatus']);
      const iPrice  = col(['precio_recibido', 'precio recibido', 'price', 'precio']);
      const iPedId  = col(['pedido_id', 'pedido id', 'pedidoid', 'folio']);
      const iHora   = col(['hora', 'time', 'hour']);
      const iSolic  = col(['solicitante', 'solicitado', 'requested by', 'usuario']);
      const iUrg    = col(['urgencia', 'urgency', 'prioridad']);
      const iNotes  = col(['notas', 'notes', 'nota', 'observaciones']);
      const iTotal  = col(['total']);

      // Safe cell reader — falls back to hardcoded fallback index if header not found
      const cell = (r: string[], dynamicIdx: number, fallback: number) =>
        r[dynamicIdx !== -1 ? dynamicIdx : fallback] ?? '';

      const VALID_STATUSES = new Set(['Pendiente', 'Pedido', 'Completado']);

      const data = rows.slice(1).flatMap((r, idx) => {
        const pedidoId = cell(r, iPedId, 9);
        const estado   = cell(r, iStatus, 6);
        const partNum  = cell(r, iPart, 1);

        // Skip completely blank rows
        if (!pedidoId && !partNum) return [];

        // Skip rows with unrecognised status values (corrupted legacy data)
        if (estado && !VALID_STATUSES.has(estado)) return [];

        // Guard numeric fields — reject strings that look like names
        const rawQty   = cell(r, iQty, 4);
        const rawTotal = cell(r, iTotal, 14);
        const cantidad = /^\d+(\.\d+)?$/.test(rawQty.trim())    ? rawQty   : '';
        const total    = /^\d+(\.\d+)?$/.test(rawTotal.trim())  ? rawTotal : '';

        return [{
          id:          String(idx),
          pedidoId:    pedidoId || `ROW-${idx}`,
          fecha:       cell(r, iDate, 0),
          hora:        cell(r, iHora, 10),
          solicitante: cell(r, iSolic, 11),
          partNum,
          descripcion: cell(r, iDesc, 2),
          equipo:      cell(r, iEquip, 3),
          cantidad,
          precioUnit:  cell(r, iPrice, 7),
          total,
          urgencia:    cell(r, iUrg, 12),
          fuente:      cell(r, iDealer, 5),
          notas:       cell(r, iNotes, 13),
          estado:      estado || 'Pendiente',
        }];
      });
      setHistorial(data.reverse()); // newest first
      setHistorialLoaded(true);
    } catch {
      setHistorialError(true);
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  }

  // Auto-load historial on mount (Gerencia starts on historial tab directly)
  useEffect(() => {
    loadHistorial();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleTabChange(t: Tab) {
    setTab(t);
    if (t === 'historial') loadHistorial();
  }

  // ── Status change (Gerencia only) ─────────────────────────────────────────
  function handleStatusChange(rowId: string, newStatus: string) {
    setHistorial((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, estado: newStatus } : r))
    );
  }

  // ── Manual part validation ────────────────────────────────────────────────
  function validateManual(): boolean {
    const e: Partial<ManualForm> = {};
    if (!manual.part_number.trim()) e.part_number = 'Requerido';
    if (!manual.description.trim()) e.description = 'Requerido';
    if (!manual.quantity || isNaN(Number(manual.quantity)) || Number(manual.quantity) < 1) e.quantity = 'Mín 1';
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

  // ── Submit cart → Sheet ───────────────────────────────────────────────────
  async function handleSubmit() {
    if (items.length === 0) return;
    setSubmitting(true);
    setSubmitError(false);
    const fecha = mexicoDate();
    const hora = mexicoTime();
    const pedidoId = newPedidoId();

    try {
      await Promise.all(
        items.map((item) =>
          appendRow(SHEET_TABS.COTIZACIONES, [
            fecha,                                              // A: Fecha
            item.part_number,                                   // B: Part_Number
            item.description,                                   // C: Descripcion
            item.equipment,                                     // D: Equipo
            String(item.quantity),                              // E: Qty
            item.isManual ? 'Manual' : item.source,             // F: Dealer
            'Pendiente',                                        // G: Status
            '',                                                 // H: Precio_Recibido (proveedor llena)
            '',                                                 // I: Fecha_Respuesta (proveedor llena)
            pedidoId,                                           // J: PEDIDO_ID
            hora,                                               // K: Hora
            userName,                                           // L: Solicitante
            item.urgencia,                                      // M: Urgencia
            item.notes,                                         // N: Notas
            (item.quantity * item.unit_price).toFixed(2),       // O: Total
          ])
        )
      );
      clearCart();
      setSubmitted(true);
      setHistorialLoaded(false); // force reload next time
    } catch {
      setSubmitError(true);
    } finally {
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
          El pedido fue registrado en el Sheet.<br />Gerencia recibirá la notificación.
        </p>
        <button
          onClick={() => { setSubmitted(false); navigate('/workshop'); }}
          className="w-full py-3 rounded-xl font-semibold text-white"
          style={{ backgroundColor: '#162252' }}
        >
          Volver al Inicio
        </button>
        <button
          onClick={() => { setSubmitted(false); handleTabChange('historial'); }}
          className="w-full py-3 rounded-xl font-semibold border"
          style={{ borderColor: '#162252', color: '#162252' }}
        >
          Ver Historial
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <ShoppingCart size={24} color="#162252" />
        <h1 className="text-xl font-bold text-text">Pedidos de Refacciones</h1>
      </div>

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
        <button
          onClick={() => handleTabChange('historial')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-colors"
          style={{
            backgroundColor: tab === 'historial' ? '#162252' : '#FFFFFF',
            color: tab === 'historial' ? '#FFFFFF' : '#6B7280',
          }}
        >
          <ClipboardList size={15} />
          {isGerencia ? 'Pedidos Pendientes' : 'Historial'}
        </button>
      </div>

      {/* ════════════════════ CARRITO TAB ════════════════════ */}
      {tab === 'carrito' && isJT && (
        <div className="flex flex-col gap-4">

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
                    Error al enviar — verifica la conexión e intenta de nuevo.
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
        </div>
      )}

      {/* ════════════════════ HISTORIAL TAB ════════════════════ */}
      {tab === 'historial' && (
        <div className="flex flex-col gap-3">
          {loadingHistorial && (
            <div className="flex justify-center py-10">
              <Loader2 size={28} className="animate-spin" style={{ color: '#162252' }} />
            </div>
          )}

          {/* Connection error */}
          {!loadingHistorial && historialError && (
            <div className="flex flex-col items-center gap-4 py-10">
              <WifiOff size={40} color="#9CA3AF" />
              <div className="text-center">
                <p className="text-sm font-semibold text-text">Sin conexión al servidor</p>
                <p className="text-xs text-text-secondary mt-1">
                  No se pudieron cargar los pedidos.<br />Verifica el VPS e intenta de nuevo.
                </p>
              </div>
              <button
                onClick={() => { setHistorialLoaded(false); loadHistorial(true); }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm"
                style={{ backgroundColor: '#162252' }}
              >
                <RefreshCw size={15} />
                Reintentar
              </button>
            </div>
          )}

          {/* Empty (loaded successfully but zero rows) */}
          {!loadingHistorial && !historialError && historial.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-10">
              <ClipboardList size={48} color="#9CA3AF" />
              <p className="text-text-secondary text-center text-sm">
                No hay pedidos registrados aún.
              </p>
              <button
                onClick={() => loadHistorial(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium"
                style={{ borderColor: '#162252', color: '#162252' }}
              >
                <RefreshCw size={14} />
                Actualizar
              </button>
            </div>
          )}

          {historial.map((row) => (
            <PedidoRowCard
              key={row.id}
              row={row}
              isGerencia={isGerencia}
              onStatusChange={handleStatusChange}
            />
          ))}

          {/* Refresh at bottom when results are showing */}
          {!loadingHistorial && !historialError && historial.length > 0 && (
            <button
              onClick={() => loadHistorial(true)}
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
          <button onClick={onToggle} className="p-1">
            {expanded ? <ChevronUp size={16} color="#6B7280" /> : <ChevronDown size={16} color="#6B7280" />}
          </button>
          <button onClick={onRemove} className="p-1">
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
                min={1}
                value={item.quantity}
                onChange={(e) => onUpdate({ quantity: Math.max(1, Number(e.target.value)) })}
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
  const f = (field: keyof ManualForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...form, [field]: e.target.value });

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
            value={form.part_number}
            onChange={f('part_number')}
            placeholder="Ej: 6745-11-3102"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          />
          {errors.part_number && <p className="text-xs text-red-500 mt-0.5">{errors.part_number}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-secondary mb-1">Cantidad *</label>
          <input
            type="number"
            min={1}
            value={form.quantity}
            onChange={f('quantity')}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
          />
          {errors.quantity && <p className="text-xs text-red-500 mt-0.5">{errors.quantity}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-text-secondary mb-1">Descripción *</label>
        <input
          type="text"
          value={form.description}
          onChange={f('description')}
          placeholder="Nombre o descripción de la parte"
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-white text-text"
        />
        {errors.description && <p className="text-xs text-red-500 mt-0.5">{errors.description}</p>}
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
  row: PedidoRow;
  isGerencia: boolean;
  onStatusChange: (id: string, newStatus: string) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const urgCfg = (URGENCIA_CONFIG as Record<string, { color: string; bg: string }>)[row.urgencia] ?? URGENCIA_CONFIG.Normal;
  const sCfg = STATUS_STYLE[row.estado] ?? STATUS_STYLE.Pendiente;
  const nextStatus = STATUS_NEXT[row.estado] ?? null;

  async function handleAdvance() {
    if (!nextStatus || updating) return;
    setUpdating(true);
    try {
      // Column J (index 9) = PEDIDO_ID, Column G (index 6) = Status
      await updateCell(SHEET_TABS.COTIZACIONES, 9, row.pedidoId, 6, nextStatus);
      onStatusChange(row.id, nextStatus);
    } catch {
      // silently fail — state not updated
    } finally {
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
        <div className="flex gap-4 text-xs text-text-secondary mb-3">
          {row.equipo && <span>📍 {row.equipo}</span>}
          <span>×{row.cantidad}</span>
          {row.total && <span className="font-semibold text-text">${row.total}</span>}
          {row.fuente && <span>{row.fuente}</span>}
        </div>
        {row.notas && <p className="text-xs text-text-secondary mb-3 italic">{row.notas}</p>}

        {/* Gerencia status action */}
        {isGerencia && nextStatus && (
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
