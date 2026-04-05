import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Disc3,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Gauge,
  Ruler,
  ClipboardList,
  Loader2,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { mexicoDate, mexicoTime } from '../lib/date-utils';

// ── Tire position options by equipment type ─────────────────────────────────
const POSITIONS_BY_TYPE: Record<string, string[]> = {
  'Camión Articulado': [
    'Delantera Izquierda',
    'Delantera Derecha',
    'Trasera Izquierda Exterior',
    'Trasera Izquierda Interior',
    'Trasera Derecha Exterior',
    'Trasera Derecha Interior',
  ],
  Cargador: [
    'Delantera Izquierda',
    'Delantera Derecha',
    'Trasera Izquierda',
    'Trasera Derecha',
  ],
  'Camión Pesado': [
    'Delantera Izquierda',
    'Delantera Derecha',
    'Eje Medio Izquierda Exterior',
    'Eje Medio Izquierda Interior',
    'Eje Medio Derecha Exterior',
    'Eje Medio Derecha Interior',
    'Eje Trasero Izquierda Exterior',
    'Eje Trasero Izquierda Interior',
    'Eje Trasero Derecha Exterior',
    'Eje Trasero Derecha Interior',
  ],
  default: [
    'Delantera Izquierda',
    'Delantera Derecha',
    'Trasera Izquierda',
    'Trasera Derecha',
  ],
};

const CONDICIONES = [
  { value: 'Buena', color: '#16A34A', bg: '#F0FDF4' },
  { value: 'Desgaste Normal', color: '#2563EB', bg: '#EFF6FF' },
  { value: 'Desgaste Irregular', color: '#F59E0B', bg: '#FFFBEB' },
  { value: 'Dañada', color: '#DC2626', bg: '#FEF2F2' },
  { value: 'Cambio Urgente', color: '#9B1C1C', bg: '#FEF2F2' },
];

const ACCIONES = [
  'Sin Acción',
  'Rotar',
  'Reparar / Parchar',
  'Cambiar Inmediato',
];

const MARCAS_COMUNES = ['Bridgestone', 'Michelin', 'Goodyear', 'Continental', 'Hankook', 'Firestone', 'Otra'];

type Step = 'equipo' | 'llanta' | 'success';

interface LlantaForm {
  posicion: string;
  marca: string;
  medida: string;
  serie: string;
  presion: string;
  profundidad: string;
  condicion: string;
  accion: string;
  observaciones: string;
}

const emptyLlanta = (): LlantaForm => ({
  posicion: '',
  marca: '',
  medida: '',
  serie: '',
  presion: '',
  profundidad: '',
  condicion: '',
  accion: '',
  observaciones: '',
});

// ── Tread depth color helper ─────────────────────────────────────────────────
function profundidadColor(mm: string): string {
  const v = parseFloat(mm);
  if (isNaN(v)) return '#6B7280';
  if (v >= 10) return '#16A34A';
  if (v >= 5) return '#F59E0B';
  return '#DC2626';
}

// ── PSI color helper ─────────────────────────────────────────────────────────
function presionColor(psi: string): string {
  const v = parseFloat(psi);
  if (isNaN(v)) return '#6B7280';
  if (v >= 90 && v <= 130) return '#16A34A';
  if (v >= 70 && v < 90) return '#F59E0B';
  return '#DC2626';
}

// ── Row counter helper ───────────────────────────────────────────────────────
let _rowCounter = 1;
function nextRowNum(): string {
  return String(_rowCounter++);
}

export default function NeumaticosPage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const [step, setStep] = useState<Step>('equipo');

  // Step 1 — equipment
  const [selectedUnit, setSelectedUnit] = useState('');
  const [horometro, setHorometro] = useState('');

  // Step 2 — llanta form
  const [llanta, setLlanta] = useState<LlantaForm>(emptyLlanta());
  const [submitting, setSubmitting] = useState(false);
  const [registradas, setRegistradas] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<LlantaForm>>({});

  const equipment = EQUIPMENT_CATALOG.find((e) => e.unit_id === selectedUnit);
  const positions =
    equipment
      ? (POSITIONS_BY_TYPE[equipment.type] ?? POSITIONS_BY_TYPE.default)
      : POSITIONS_BY_TYPE.default;

  // Filter out already registered positions from this session
  const availablePositions = positions.filter((p) => !registradas.includes(p));

  // ── Validation ───────────────────────────────────────────────────────────
  function validateLlanta(): boolean {
    const e: Partial<LlantaForm> = {};
    if (!llanta.posicion) e.posicion = 'Requerido';
    if (!llanta.presion) e.presion = 'Requerido';
    if (!llanta.profundidad) e.profundidad = 'Requerido';
    if (!llanta.condicion) e.condicion = 'Requerido';
    if (!llanta.accion) e.accion = 'Requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit one tire row ──────────────────────────────────────────────────
  async function handleSubmitLlanta() {
    if (!validateLlanta()) return;
    setSubmitting(true);

    const fecha = mexicoDate();
    const hora = mexicoTime();

    const values = [
      nextRowNum(),
      fecha,
      hora,
      selectedUnit,
      equipment?.model ?? '',
      userName,
      horometro,
      llanta.posicion,
      llanta.marca,
      llanta.medida,
      llanta.serie,
      llanta.presion,
      llanta.profundidad,
      llanta.condicion,
      llanta.accion,
      llanta.observaciones,
    ];

    try {
      await appendRow(SHEET_TABS.NEUMATICOS, values);
      setRegistradas((prev) => [...prev, llanta.posicion]);
      setLlanta(emptyLlanta());
      setErrors({});
    } catch {
      // Silent fail — offline queue will retry
    } finally {
      setSubmitting(false);
    }
  }

  function handleFinish() {
    setStep('success');
  }

  // ── STEP 1: Equipment ────────────────────────────────────────────────────
  if (step === 'equipo') {
    const validEquipment = EQUIPMENT_CATALOG.filter(
      (e) => e.type !== 'Bulldozer' && e.type !== 'Excavadora'
    );

    return (
      <div className="flex flex-col py-4 animate-fade-up">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-1">
            <ChevronLeft size={24} color="#162252" />
          </button>
          <div className="flex items-center gap-2">
            <Disc3 size={24} color="#162252" />
            <h1 className="text-xl font-bold text-text">Reporte de Neumáticos</h1>
          </div>
        </div>

        {/* Subtitle */}
        <p className="text-sm text-text-secondary mb-4">
          Selecciona la unidad a inspeccionar
        </p>

        {/* Equipment list */}
        <div className="flex flex-col gap-2 mb-6">
          {validEquipment.map((eq) => (
            <button
              key={eq.unit_id}
              onClick={() => setSelectedUnit(eq.unit_id)}
              className="flex items-center justify-between p-4 rounded-xl border transition-all btn-press"
              style={{
                backgroundColor: selectedUnit === eq.unit_id ? '#EFF6FF' : '#FFFFFF',
                borderColor: selectedUnit === eq.unit_id ? '#2563EB' : '#E5E7EB',
              }}
            >
              <div className="flex flex-col items-start gap-0.5">
                <span className="font-semibold text-text">{eq.unit_id}</span>
                <span className="text-sm text-text-secondary">{eq.model}</span>
              </div>
              <span
                className="text-xs font-medium px-2 py-1 rounded-full"
                style={{
                  backgroundColor:
                    eq.status === 'operativo'
                      ? '#DCFCE7'
                      : eq.status === 'alerta'
                        ? '#FEF9C3'
                        : '#FEE2E2',
                  color:
                    eq.status === 'operativo'
                      ? '#16A34A'
                      : eq.status === 'alerta'
                        ? '#92400E'
                        : '#DC2626',
                }}
              >
                {eq.status}
              </span>
            </button>
          ))}
        </div>

        {/* Horómetro */}
        {selectedUnit && (
          <div className="mb-6 animate-fade-up">
            <label className="block text-sm font-medium text-text mb-1">
              Horómetro actual (hrs)
            </label>
            <input
              type="number"
              value={horometro}
              onChange={(e) => setHorometro(e.target.value)}
              placeholder={String(equipment?.current_horometro ?? '')}
              className="w-full border border-border rounded-xl px-4 py-3 text-text bg-white"
            />
          </div>
        )}

        <button
          disabled={!selectedUnit}
          onClick={() => setStep('llanta')}
          className="w-full py-3 rounded-xl font-semibold text-white transition-opacity"
          style={{
            backgroundColor: selectedUnit ? '#162252' : '#9CA3AF',
          }}
        >
          Continuar →
        </button>
      </div>
    );
  }

  // ── SUCCESS ──────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-up gap-6">
        <CheckCircle2 size={64} color="#16A34A" />
        <h2 className="text-2xl font-bold text-text text-center">
          Reporte Completado
        </h2>
        <p className="text-text-secondary text-center">
          {registradas.length} neumático{registradas.length !== 1 ? 's' : ''} registrado{registradas.length !== 1 ? 's' : ''} en el Sheet
        </p>
        <div className="w-full bg-white rounded-xl p-4 border border-border">
          {registradas.map((pos) => (
            <div key={pos} className="flex items-center gap-2 py-1">
              <CheckCircle2 size={16} color="#16A34A" />
              <span className="text-sm text-text">{pos}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => navigate('/workshop')}
          className="w-full py-3 rounded-xl font-semibold text-white"
          style={{ backgroundColor: '#162252' }}
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  // ── STEP 2: Llanta form ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button onClick={() => setStep('equipo')} className="p-1">
            <ChevronLeft size={24} color="#162252" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-text">Neumáticos — {selectedUnit}</h1>
            <p className="text-xs text-text-secondary">{equipment?.model}</p>
          </div>
        </div>
        <span
          className="text-xs font-semibold px-2 py-1 rounded-full"
          style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}
        >
          {registradas.length}/{positions.length} registradas
        </span>
      </div>

      {/* Registered positions summary */}
      {registradas.length > 0 && (
        <div className="mb-4 p-3 rounded-xl border" style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}>
          <p className="text-xs font-medium text-success mb-1">Registradas esta sesión:</p>
          <div className="flex flex-wrap gap-1">
            {registradas.map((pos) => (
              <span key={pos} className="text-xs px-2 py-0.5 rounded-full bg-white border border-success text-success">
                {pos}
              </span>
            ))}
          </div>
        </div>
      )}

      {availablePositions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <CheckCircle2 size={48} color="#16A34A" />
          <p className="text-center font-semibold text-text">
            Todas las posiciones registradas
          </p>
          <button
            onClick={handleFinish}
            className="w-full py-3 rounded-xl font-semibold text-white"
            style={{ backgroundColor: '#162252' }}
          >
            Finalizar Reporte
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* ─ Posición ─ */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">
              Posición de la Llanta *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availablePositions.map((pos) => (
                <button
                  key={pos}
                  onClick={() => setLlanta((f) => ({ ...f, posicion: pos }))}
                  className="text-left text-sm px-3 py-2 rounded-xl border transition-all leading-snug"
                  style={{
                    backgroundColor: llanta.posicion === pos ? '#EFF6FF' : '#FFFFFF',
                    borderColor: llanta.posicion === pos ? '#2563EB' : '#E5E7EB',
                    color: llanta.posicion === pos ? '#1E3A8A' : '#374151',
                    fontWeight: llanta.posicion === pos ? '600' : '400',
                  }}
                >
                  {pos}
                </button>
              ))}
            </div>
            {errors.posicion && (
              <p className="text-xs text-red-500 mt-1">{errors.posicion}</p>
            )}
          </div>

          {/* ─ Marca & Medida ─ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-text mb-1">Marca</label>
              <select
                value={llanta.marca}
                onChange={(e) => setLlanta((f) => ({ ...f, marca: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
              >
                <option value="">Seleccionar</option>
                {MARCAS_COMUNES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-text mb-1">Medida</label>
              <input
                type="text"
                value={llanta.medida}
                onChange={(e) => setLlanta((f) => ({ ...f, medida: e.target.value }))}
                placeholder="26.5R25"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
              />
            </div>
          </div>

          {/* ─ Serie/DOT ─ */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">Serie / DOT</label>
            <input
              type="text"
              value={llanta.serie}
              onChange={(e) => setLlanta((f) => ({ ...f, serie: e.target.value }))}
              placeholder="Ej: DOT 4320"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
            />
          </div>

          {/* ─ Presión & Profundidad ─ */}
          <div className="grid grid-cols-2 gap-3">
            {/* Presión */}
            <div>
              <label className="block text-sm font-semibold text-text mb-1">
                <span className="flex items-center gap-1">
                  <Gauge size={14} />
                  Presión (PSI) *
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={llanta.presion}
                  onChange={(e) => setLlanta((f) => ({ ...f, presion: e.target.value }))}
                  placeholder="110"
                  className="w-full border rounded-xl px-3 py-2.5 text-text bg-white text-sm pr-12"
                  style={{ borderColor: llanta.presion ? presionColor(llanta.presion) : '#E5E7EB' }}
                />
                {llanta.presion && (
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold"
                    style={{ color: presionColor(llanta.presion) }}
                  >
                    PSI
                  </span>
                )}
              </div>
              {errors.presion && (
                <p className="text-xs text-red-500 mt-1">{errors.presion}</p>
              )}
              {llanta.presion && (
                <p className="text-xs mt-1" style={{ color: presionColor(llanta.presion) }}>
                  {parseFloat(llanta.presion) < 70
                    ? '⚠️ Baja — Riesgo'
                    : parseFloat(llanta.presion) > 130
                      ? '⚠️ Alta — Verificar'
                      : '✓ Rango normal'}
                </p>
              )}
            </div>

            {/* Profundidad */}
            <div>
              <label className="block text-sm font-semibold text-text mb-1">
                <span className="flex items-center gap-1">
                  <Ruler size={14} />
                  Profundidad (mm) *
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  value={llanta.profundidad}
                  onChange={(e) => setLlanta((f) => ({ ...f, profundidad: e.target.value }))}
                  placeholder="12"
                  className="w-full border rounded-xl px-3 py-2.5 text-text bg-white text-sm pr-10"
                  style={{ borderColor: llanta.profundidad ? profundidadColor(llanta.profundidad) : '#E5E7EB' }}
                />
                {llanta.profundidad && (
                  <span
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold"
                    style={{ color: profundidadColor(llanta.profundidad) }}
                  >
                    mm
                  </span>
                )}
              </div>
              {errors.profundidad && (
                <p className="text-xs text-red-500 mt-1">{errors.profundidad}</p>
              )}
              {llanta.profundidad && (
                <p className="text-xs mt-1" style={{ color: profundidadColor(llanta.profundidad) }}>
                  {parseFloat(llanta.profundidad) < 5
                    ? '⚠️ Crítico — Cambiar'
                    : parseFloat(llanta.profundidad) < 10
                      ? '⚠️ Advertencia'
                      : '✓ Buen estado'}
                </p>
              )}
            </div>
          </div>

          {/* ─ Visual depth bar ─ */}
          {llanta.profundidad && (
            <div>
              <div className="flex items-center justify-between text-xs text-text-secondary mb-1">
                <span>0 mm</span>
                <span>Profundidad de banda</span>
                <span>20 mm</span>
              </div>
              <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min((parseFloat(llanta.profundidad) / 20) * 100, 100)}%`,
                    backgroundColor: profundidadColor(llanta.profundidad),
                  }}
                />
              </div>
              <div className="flex justify-between text-xs mt-0.5">
                <span style={{ color: '#DC2626' }}>Cambio &lt;5</span>
                <span style={{ color: '#F59E0B' }}>Advertencia 5-10</span>
                <span style={{ color: '#16A34A' }}>OK &gt;10</span>
              </div>
            </div>
          )}

          {/* ─ Condición ─ */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">
              <span className="flex items-center gap-1">
                <ClipboardList size={14} />
                Condición Visual *
              </span>
            </label>
            <div className="flex flex-col gap-2">
              {CONDICIONES.map(({ value, color, bg }) => (
                <button
                  key={value}
                  onClick={() => setLlanta((f) => ({ ...f, condicion: value }))}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-sm font-medium"
                  style={{
                    backgroundColor: llanta.condicion === value ? bg : '#FFFFFF',
                    borderColor: llanta.condicion === value ? color : '#E5E7EB',
                    color: llanta.condicion === value ? color : '#374151',
                  }}
                >
                  {value}
                  {llanta.condicion === value && (
                    <CheckCircle2 size={16} color={color} />
                  )}
                </button>
              ))}
            </div>
            {errors.condicion && (
              <p className="text-xs text-red-500 mt-1">{errors.condicion}</p>
            )}
          </div>

          {/* ─ Acción ─ */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">
              Acción Requerida *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ACCIONES.map((ac) => (
                <button
                  key={ac}
                  onClick={() => setLlanta((f) => ({ ...f, accion: ac }))}
                  className="text-sm px-3 py-2.5 rounded-xl border transition-all leading-snug"
                  style={{
                    backgroundColor: llanta.accion === ac ? '#162252' : '#FFFFFF',
                    borderColor: llanta.accion === ac ? '#162252' : '#E5E7EB',
                    color: llanta.accion === ac ? '#FFFFFF' : '#374151',
                    fontWeight: llanta.accion === ac ? '600' : '400',
                  }}
                >
                  {ac}
                </button>
              ))}
            </div>
            {errors.accion && (
              <p className="text-xs text-red-500 mt-1">{errors.accion}</p>
            )}
          </div>

          {/* ─ Observaciones ─ */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">Observaciones</label>
            <textarea
              value={llanta.observaciones}
              onChange={(e) => setLlanta((f) => ({ ...f, observaciones: e.target.value }))}
              placeholder="Cortes, bultos, mordidas, desgaste irregular..."
              rows={3}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm resize-none"
            />
          </div>

          {/* ─ Warnings ─ */}
          {(parseFloat(llanta.profundidad) < 5 || parseFloat(llanta.presion) < 70 || llanta.condicion === 'Cambio Urgente') && (
            <div
              className="flex items-start gap-2 p-3 rounded-xl"
              style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
            >
              <AlertTriangle size={18} color="#DC2626" className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Atención requerida</p>
                <p className="text-xs text-red-600">
                  Esta llanta presenta condiciones críticas. Registra y notifica al supervisor de inmediato.
                </p>
              </div>
            </div>
          )}

          {/* ─ Action buttons ─ */}
          <div className="flex gap-3 mt-2 pb-8">
            <button
              disabled={submitting}
              onClick={handleSubmitLlanta}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-opacity"
              style={{ backgroundColor: '#162252' }}
            >
              {submitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Disc3 size={18} />
                  Registrar Llanta
                </>
              )}
            </button>
            {registradas.length > 0 && (
              <button
                onClick={handleFinish}
                className="px-4 py-3 rounded-xl font-semibold border transition-all"
                style={{ borderColor: '#162252', color: '#162252', backgroundColor: '#FFFFFF' }}
              >
                Finalizar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
