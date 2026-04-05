import { useState } from 'react';
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
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useCartStore, type CartItem } from '../stores/cart-store';
import { appendRow, readRange, updateCell, SHEET_TABS } from '../lib/sheets-api';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { mexicoDate, mexicoTime } from '../lib/date-utils';

// ── Sheet columns for Cotizaciones_Pendientes ────────────────────────────────
// # | PEDIDO_ID | FECHA | HORA | SOLICITANTE | PARTE_NUM | DESCRIPCION |
// EQUIPO | CANTIDAD | PRECIO_UNIT | TOTAL | URGENCIA | FUENTE | NOTAS | ESTADO

const URGENCIA_CONFIG = {
  Normal:  { color: '#16A34A', bg: '#F0FDF4' },
  Urgente: { color: '#D97706', bg: '#FFFBEB' },
  Crítico: { color: '#DC2626', bg: '#FEF2F2' },
} as const;

const EQUIPMENT_OPTIONS = EQUIPMENT_CATALOG.map((e) => e.unit_id);

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
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  // ── Load historial ────────────────────────────────────────────────────────
  async function loadHistorial() {
    if (historialLoaded) return;
    setLoadingHistorial(true);
    try {
      const rows = await readRange(SHEET_TABS.COTIZACIONES);
      // rows[0] = headers, rows[1..] = data
      const data = rows.slice(1).map((r, idx) => ({
        id: String(idx),
        pedidoId:    r[1]  ?? '',
        fecha:       r[2]  ?? '',
        hora:        r[3]  ?? '',
        solicitante: r[4]  ?? '',
        partNum:     r[5]  ?? '',
        descripcion: r[6]  ?? '',
        equipo:      r[7]  ?? '',
        cantidad:    r[8]  ?? '',
        precioUnit:  r[9]  ?? '',
        total:       r[10] ?? '',
        urgencia:    r[11] ?? '',
        fuente:      r[12] ?? '',
        notas:       r[13] ?? '',
        estado:      r[14] ?? 'Pendiente',
      }));
      setHistorial(data.reverse()); // newest first
      setHistorialLoaded(true);
    } catch {
      setHistorial([]);
    } finally {
      setLoadingHistorial(false);
    }
  }

  function handleTabChange(t: Tab) {
    setTab(t);
    if (t === 'historial' && !historialLoaded) loadHistorial();
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
    const fecha = mexicoDate();
    const hora = mexicoTime();
    const pedidoId = newPedidoId();

    try {
      await Promise.all(
        items.map((item, idx) =>
          appendRow(SHEET_TABS.COTIZACIONES, [
            String(idx + 1),                     // #
            pedidoId,                             // PEDIDO_ID
            fecha,                               // FECHA
            hora,                               // HORA
            userName,                           // SOLICITANTE
            item.part_number,                   // PARTE_NUM
            item.description,                   // DESCRIPCION
            item.equipment,                     // EQUIPO
            String(item.quantity),              // CANTIDAD
            item.unit_price.toFixed(2),         // PRECIO_UNIT
            (item.quantity * item.unit_price).toFixed(2), // TOTAL
            item.urgencia,                      // URGENCIA
            item.isManual ? 'Manual' : item.source, // FUENTE
            item.notes,                         // NOTAS
            'Pendiente',                        // ESTADO
          ])
        )
      );
      clearCart();
      setSubmitted(true);
      setHistorialLoaded(false); // force reload next time
    } catch {
      // silent — offline queue retries
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
                    Enviar Pedido ({items.length} {items.length === 1 ? 'parte' : 'partes'})
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

          {!loadingHistorial && historial.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-10">
              <ClipboardList size={48} color="#9CA3AF" />
              <p className="text-text-secondary text-center text-sm">
                No hay pedidos registrados aún.
              </p>
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

          {!loadingHistorial && historial.length > 0 && (
            <button
              onClick={() => { setHistorialLoaded(false); loadHistorial(); }}
              className="text-center text-sm py-2"
              style={{ color: '#2563EB' }}
            >
              ↺ Actualizar
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
}: {
  item: CartItem;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (u: Partial<CartItem>) => void;
  onRemove: () => void;
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
              {EQUIPMENT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
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
}: {
  form: ManualForm;
  errors: Partial<ManualForm>;
  onChange: (f: ManualForm) => void;
  onAdd: () => void;
  onCancel: () => void;
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
          {EQUIPMENT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
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
      // Column B (index 1) = PEDIDO_ID, Column O (index 14) = ESTADO
      await updateCell(SHEET_TABS.COTIZACIONES, 1, row.pedidoId, 14, nextStatus);
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
