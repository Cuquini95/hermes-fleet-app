import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Disc3,
  ChevronLeft,
  CheckCircle2,
  AlertTriangle,
  Gauge,
  Ruler,
  Loader2,
} from 'lucide-react';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import { mexicoDate } from '../lib/date-utils';

// ── Column order matches Sheet "13 Neumáticos" cols A→S ─────────────────────
// A  #
// B  CÓDIGO UNIDAD
// C  MODELO
// D  POSICIÓN
// E  MARCA NEUMÁTICO
// F  MODELO NEUMÁTICO
// G  MEDIDA
// H  N° SERIE
// I  FECHA INSTALACIÓN        (blank — filled when tire is installed)
// J  HORÓMETRO INSTALACIÓN    (blank — filled when tire is installed)
// K  HORÓMETRO ACTUAL
// L  HORAS USO                (blank — sheet calculates K-J)
// M  PROFUNDIDAD ORIGINAL(mm)
// N  PROFUNDIDAD ACTUAL (mm)
// O  DESGASTE %               (blank — sheet calculates (M-N)/M*100)
// P  PRESIÓN RECOMENDADA(PSI)
// Q  ÚLTIMA PRESIÓN (PSI)
// R  FECHA ÚLT. INSPECCIÓN
// S  ESTADO

// ── Positions by equipment type ──────────────────────────────────────────────
// Camión Articulado (CAT 740B, HM400-3): 6 llantas
//   I1 D2 — Delanteras
//   I3 D4 — Trasera eje 2
//   I5 D6 — Trasera eje 3
// Camión Pesado Mack GR84B 8x4: 12 llantas
//   I1 D2 — Delanteras
//   I3 D4 — Eje 2 simples
//   DE5 DI6 — Eje 3 duales derecha (Exterior / Interior)
//   LI7 LE8 — Eje 3 duales izquierda (Interior / Exterior)
//   DE9 DI10 — Eje 4 duales derecha
//   LI11 LE12 — Eje 4 duales izquierda
// Cargador DL420A: 4 llantas
//   I1 D2 — Delanteras
//   I3 D4 — Traseras
const POSITIONS_BY_TYPE: Record<string, string[]> = {
  'Camión Articulado': ['I1', 'D2', 'I3', 'D4', 'I5', 'D6'],
  Cargador:            ['I1', 'D2', 'I3', 'D4'],
  'Camión Pesado':     ['I1', 'D2', 'I3', 'D4', 'DE5', 'DI6', 'LI7', 'LE8', 'DE9', 'DI10', 'LI11', 'LE12'],
  default:             ['I1', 'D2', 'I3', 'D4'],
};

// ── Recommended PSI by type + position ──────────────────────────────────────
function getPresionRecomendada(tipo: string, posicion: string): string {
  const esFrontal = posicion.startsWith('F');
  if (tipo === 'Camión Pesado') return esFrontal ? '120' : '115';
  if (tipo === 'Camión Articulado') return esFrontal ? '115' : '110';
  if (tipo === 'Cargador') return '80';
  return '115';
}

// ── Auto-calculate ESTADO from form values ───────────────────────────────────
function calcEstado(condicion: string, profActual: string, presion: string): string {
  const d = parseFloat(profActual);
  const p = parseFloat(presion);
  if (condicion === 'Cambio Urgente' || (!isNaN(d) && d < 5)) return 'Cambio Urgente';
  if (condicion === 'Dañada') return 'Dañada';
  if (!isNaN(p) && (p < 70 || p > 135)) return 'Desgaste Irregular';
  if (condicion === 'Desgaste Irregular' || (!isNaN(d) && d < 10)) return 'Desgaste Irregular';
  if (condicion === 'Desgaste Normal') return 'Desgaste Normal';
  return 'Buena';
}

// ── Visual helpers ───────────────────────────────────────────────────────────
const CONDICIONES = [
  { value: 'Buena',              color: '#16A34A', bg: '#F0FDF4' },
  { value: 'Desgaste Normal',    color: '#2563EB', bg: '#EFF6FF' },
  { value: 'Desgaste Irregular', color: '#F59E0B', bg: '#FFFBEB' },
  { value: 'Dañada',             color: '#DC2626', bg: '#FEF2F2' },
  { value: 'Cambio Urgente',     color: '#9B1C1C', bg: '#FEF2F2' },
];

const MARCAS = ['Bridgestone', 'Michelin', 'Goodyear', 'Continental', 'Hankook', 'Firestone', 'Otra'];

function depthColor(mm: string) {
  const v = parseFloat(mm);
  if (isNaN(v)) return '#9CA3AF';
  if (v >= 10) return '#16A34A';
  if (v >= 5) return '#F59E0B';
  return '#DC2626';
}

function psiColor(psi: string) {
  const v = parseFloat(psi);
  if (isNaN(v)) return '#9CA3AF';
  if (v >= 80 && v <= 130) return '#16A34A';
  if (v >= 65) return '#F59E0B';
  return '#DC2626';
}

// ── Types ────────────────────────────────────────────────────────────────────
interface LlantaForm {
  posicion: string;
  marca: string;
  modeloLlanta: string;   // F: MODELO NEUMÁTICO  (e.g. M729, R297, XDN2)
  medida: string;         // G: MEDIDA
  serie: string;          // H: N° SERIE / DOT
  profundidadOrig: string;// M: PROFUNDIDAD ORIGINAL (mm)
  profundidad: string;    // N: PROFUNDIDAD ACTUAL (mm)
  presionRec: string;     // P: PRESIÓN RECOMENDADA — auto-filled, editable
  presion: string;        // Q: ÚLTIMA PRESIÓN (PSI)
  condicion: string;      // drives S: ESTADO
  observaciones: string;
}

const emptyLlanta = (tipo = '', posicion = ''): LlantaForm => ({
  posicion,
  marca: '',
  modeloLlanta: '',
  medida: '',
  serie: '',
  profundidadOrig: '',
  profundidad: '',
  presionRec: getPresionRecomendada(tipo, posicion),
  presion: '',
  condicion: '',
  observaciones: '',
});

type Step = 'equipo' | 'llanta' | 'success';

let _seq = 1;
function nextSeq() { return String(_seq++); }

// ════════════════════════════════════════════════════════════════════════════
export default function NeumaticosPage() {
  const navigate = useNavigate();

  const [step, setStep]             = useState<Step>('equipo');
  const [selectedUnit, setSelected] = useState('');
  const [horometro, setHorometro]   = useState('');
  const [llanta, setLlanta]         = useState<LlantaForm>(emptyLlanta());
  const [submitting, setSubmitting] = useState(false);
  const [registradas, setRegistradas] = useState<string[]>([]);
  const [errors, setErrors]         = useState<Partial<Record<keyof LlantaForm, string>>>({});

  const equipment       = EQUIPMENT_CATALOG.find((e) => e.unit_id === selectedUnit);
  const positions       = equipment ? (POSITIONS_BY_TYPE[equipment.type] ?? POSITIONS_BY_TYPE.default) : [];
  const available       = positions.filter((p) => !registradas.includes(p));
  const autoEstado      = calcEstado(llanta.condicion, llanta.profundidad, llanta.presion);
  const estadoMeta      = CONDICIONES.find((c) => c.value === llanta.condicion);

  // Set presionRec whenever position changes
  function handlePosicion(pos: string) {
    setLlanta((f) => ({
      ...f,
      posicion: pos,
      presionRec: getPresionRecomendada(equipment?.type ?? '', pos),
    }));
  }

  // ── Validation ─────────────────────────────────────────────────────────
  function validate(): boolean {
    const e: Partial<Record<keyof LlantaForm, string>> = {};
    if (!llanta.posicion)        e.posicion        = 'Requerido';
    if (!llanta.profundidadOrig) e.profundidadOrig = 'Requerido';
    if (!llanta.profundidad)     e.profundidad     = 'Requerido';
    if (!llanta.presion)         e.presion         = 'Requerido';
    if (!llanta.condicion)       e.condicion       = 'Requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit — writes cols A→S (19 values) ───────────────────────────────
  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);

    const fecha = mexicoDate();

    const values: string[] = [
      nextSeq(),                  // A  #
      selectedUnit,               // B  CÓDIGO UNIDAD
      equipment?.model ?? '',     // C  MODELO
      llanta.posicion,            // D  POSICIÓN
      llanta.marca,               // E  MARCA NEUMÁTICO
      llanta.modeloLlanta,        // F  MODELO NEUMÁTICO
      llanta.medida,              // G  MEDIDA
      llanta.serie,               // H  N° SERIE
      '',                         // I  FECHA INSTALACIÓN  (blank)
      '',                         // J  HORÓMETRO INSTALACIÓN (blank)
      horometro,                  // K  HORÓMETRO ACTUAL
      '',                         // L  HORAS USO  (sheet calculates)
      llanta.profundidadOrig,     // M  PROFUNDIDAD ORIGINAL (mm)
      llanta.profundidad,         // N  PROFUNDIDAD ACTUAL (mm)
      '',                         // O  DESGASTE %  (sheet calculates)
      llanta.presionRec,          // P  PRESIÓN RECOMENDADA (PSI)
      llanta.presion,             // Q  ÚLTIMA PRESIÓN (PSI)
      fecha,                      // R  FECHA ÚLT. INSPECCIÓN
      autoEstado,                 // S  ESTADO
    ];

    // Append observaciones as extra col if needed
    if (llanta.observaciones) values.push(llanta.observaciones);

    try {
      await appendRow(SHEET_TABS.NEUMATICOS, values);
      setRegistradas((prev) => [...prev, llanta.posicion]);
      setLlanta(emptyLlanta(equipment?.type ?? '', ''));
      setErrors({});
    } catch {
      // offline-queue will retry
    } finally {
      setSubmitting(false);
    }
  }

  // ── STEP 1: Equipment ──────────────────────────────────────────────────
  if (step === 'equipo') {
    const wheeled = EQUIPMENT_CATALOG.filter(
      (e) => e.type !== 'Bulldozer' && e.type !== 'Excavadora'
    );

    return (
      <div className="flex flex-col py-4 animate-fade-up">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-1">
            <ChevronLeft size={24} color="#162252" />
          </button>
          <Disc3 size={24} color="#162252" />
          <h1 className="text-xl font-bold text-text">Reporte de Neumáticos</h1>
        </div>

        <p className="text-sm text-text-secondary mb-4">Selecciona la unidad a inspeccionar</p>

        <div className="flex flex-col gap-2 mb-6">
          {wheeled.map((eq) => (
            <button
              key={eq.unit_id}
              onClick={() => setSelected(eq.unit_id)}
              className="flex items-center justify-between p-4 rounded-xl border transition-all btn-press"
              style={{
                backgroundColor: selectedUnit === eq.unit_id ? '#EFF6FF' : '#FFFFFF',
                borderColor:     selectedUnit === eq.unit_id ? '#2563EB' : '#E5E7EB',
              }}
            >
              <div className="text-left">
                <p className="font-semibold text-text">{eq.unit_id}</p>
                <p className="text-xs text-text-secondary">{eq.model} · {eq.type}</p>
              </div>
              <span
                className="text-xs font-medium px-2 py-1 rounded-full"
                style={{
                  backgroundColor: eq.status === 'operativo' ? '#DCFCE7' : eq.status === 'alerta' ? '#FEF9C3' : '#FEE2E2',
                  color:           eq.status === 'operativo' ? '#16A34A' : eq.status === 'alerta' ? '#92400E' : '#DC2626',
                }}
              >
                {eq.status}
              </span>
            </button>
          ))}
        </div>

        {selectedUnit && (
          <div className="mb-6 animate-fade-up">
            <label className="block text-sm font-semibold text-text mb-1">
              Horómetro actual (hrs)
            </label>
            <input
              type="number"
              value={horometro}
              onChange={(e) => setHorometro(e.target.value)}
              placeholder={String(equipment?.current_horometro ?? '')}
              className="w-full border border-border rounded-xl px-4 py-3 text-text bg-white"
            />
            <p className="text-xs text-text-secondary mt-1">
              Se registra como "Horómetro Actual" en el Sheet
            </p>
          </div>
        )}

        <button
          disabled={!selectedUnit}
          onClick={() => setStep('llanta')}
          className="w-full py-3 rounded-xl font-semibold text-white"
          style={{ backgroundColor: selectedUnit ? '#162252' : '#9CA3AF' }}
        >
          Continuar → {selectedUnit && `(${positions.length} posiciones)`}
        </button>
      </div>
    );
  }

  // ── SUCCESS ────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-up gap-6">
        <CheckCircle2 size={64} color="#16A34A" />
        <h2 className="text-2xl font-bold text-text text-center">Reporte Completado</h2>
        <p className="text-text-secondary text-center">
          {registradas.length} llanta{registradas.length !== 1 ? 's' : ''} guardada{registradas.length !== 1 ? 's' : ''} en el Sheet
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

  // ── STEP 2: Per-tire form ──────────────────────────────────────────────
  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setStep('equipo')} className="p-1">
            <ChevronLeft size={24} color="#162252" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-text">{selectedUnit} · Neumáticos</h1>
            <p className="text-xs text-text-secondary">{equipment?.model}</p>
          </div>
        </div>
        <span
          className="text-xs font-semibold px-2 py-1 rounded-full"
          style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}
        >
          {registradas.length}/{positions.length}
        </span>
      </div>

      {/* Registered summary */}
      {registradas.length > 0 && (
        <div className="mb-3 p-3 rounded-xl border" style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC' }}>
          <p className="text-xs font-medium text-success mb-1">Registradas:</p>
          <div className="flex flex-wrap gap-1">
            {registradas.map((p) => (
              <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-white border border-success text-success">{p}</span>
            ))}
          </div>
        </div>
      )}

      {available.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <CheckCircle2 size={48} color="#16A34A" />
          <p className="font-semibold text-text text-center">Todas las posiciones registradas</p>
          <button onClick={() => setStep('success')} className="w-full py-3 rounded-xl font-semibold text-white" style={{ backgroundColor: '#162252' }}>
            Finalizar Reporte
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">

          {/* ─ D: POSICIÓN ─ */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">
              Posición (col D) *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {available.map((pos) => (
                <button
                  key={pos}
                  onClick={() => handlePosicion(pos)}
                  className="text-sm px-2 py-2.5 rounded-xl border transition-all font-mono"
                  style={{
                    backgroundColor: llanta.posicion === pos ? '#162252' : '#FFFFFF',
                    borderColor:     llanta.posicion === pos ? '#162252' : '#E5E7EB',
                    color:           llanta.posicion === pos ? '#FFFFFF'  : '#374151',
                    fontWeight:      llanta.posicion === pos ? '700' : '400',
                  }}
                >
                  {pos}
                </button>
              ))}
            </div>
            {errors.posicion && <p className="text-xs text-red-500 mt-1">{errors.posicion}</p>}
          </div>

          {/* ─ E + F: MARCA + MODELO NEUMÁTICO ─ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                E · Marca Neumático
              </label>
              <select
                value={llanta.marca}
                onChange={(e) => setLlanta((f) => ({ ...f, marca: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
              >
                <option value="">Seleccionar</option>
                {MARCAS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                F · Modelo Neumático
              </label>
              <input
                type="text"
                value={llanta.modeloLlanta}
                onChange={(e) => setLlanta((f) => ({ ...f, modeloLlanta: e.target.value }))}
                placeholder="M729, R297, XDN2..."
                className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
              />
            </div>
          </div>

          {/* ─ G + H: MEDIDA + N° SERIE ─ */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                G · Medida
              </label>
              <input
                type="text"
                value={llanta.medida}
                onChange={(e) => setLlanta((f) => ({ ...f, medida: e.target.value }))}
                placeholder="26.5R25 / 11R22.5"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                H · N° Serie / DOT
              </label>
              <input
                type="text"
                value={llanta.serie}
                onChange={(e) => setLlanta((f) => ({ ...f, serie: e.target.value }))}
                placeholder="DOT 4320"
                className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
              />
            </div>
          </div>

          {/* ─ M + N: PROFUNDIDAD ORIGINAL + ACTUAL ─ */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Ruler size={14} color="#162252" />
              <span className="text-sm font-semibold text-text">Profundidad de Banda *</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  M · Original (mm)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={llanta.profundidadOrig}
                  onChange={(e) => setLlanta((f) => ({ ...f, profundidadOrig: e.target.value }))}
                  placeholder="18"
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
                />
                {errors.profundidadOrig && <p className="text-xs text-red-500 mt-0.5">{errors.profundidadOrig}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  N · Actual (mm)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    value={llanta.profundidad}
                    onChange={(e) => setLlanta((f) => ({ ...f, profundidad: e.target.value }))}
                    placeholder="12"
                    className="w-full border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
                    style={{ borderColor: llanta.profundidad ? depthColor(llanta.profundidad) : '#E5E7EB' }}
                  />
                  {llanta.profundidad && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: depthColor(llanta.profundidad) }}>mm</span>
                  )}
                </div>
                {errors.profundidad && <p className="text-xs text-red-500 mt-0.5">{errors.profundidad}</p>}
              </div>
            </div>

            {/* Visual depth bar */}
            {llanta.profundidad && (
              <div className="mt-2">
                <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min((parseFloat(llanta.profundidad) / 20) * 100, 100)}%`,
                      backgroundColor: depthColor(llanta.profundidad),
                    }}
                  />
                </div>
                <p className="text-xs mt-0.5" style={{ color: depthColor(llanta.profundidad) }}>
                  {parseFloat(llanta.profundidad) < 5 ? '⚠️ Crítico — Cambio inmediato'
                    : parseFloat(llanta.profundidad) < 10 ? '⚠️ Advertencia — Programar cambio'
                    : '✓ En rango aceptable'}
                </p>

                {/* Desgaste % preview */}
                {llanta.profundidadOrig && (
                  <p className="text-xs text-text-secondary mt-0.5">
                    Desgaste:{' '}
                    <strong>
                      {Math.round(
                        ((parseFloat(llanta.profundidadOrig) - parseFloat(llanta.profundidad)) /
                          parseFloat(llanta.profundidadOrig)) * 100
                      )}%
                    </strong>
                    {' '}(col O — el Sheet lo calcula automáticamente)
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ─ P + Q: PRESIÓN RECOMENDADA + ÚLTIMA PRESIÓN ─ */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Gauge size={14} color="#162252" />
              <span className="text-sm font-semibold text-text">Presión (PSI) *</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  P · Recomendada (PSI)
                </label>
                <input
                  type="number"
                  value={llanta.presionRec}
                  onChange={(e) => setLlanta((f) => ({ ...f, presionRec: e.target.value }))}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-gray-50 text-sm"
                />
                <p className="text-xs text-text-secondary mt-0.5">Auto por tipo/posición</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Q · Medida hoy (PSI)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={llanta.presion}
                    onChange={(e) => setLlanta((f) => ({ ...f, presion: e.target.value }))}
                    placeholder="115"
                    className="w-full border rounded-xl px-3 py-2.5 text-text bg-white text-sm"
                    style={{ borderColor: llanta.presion ? psiColor(llanta.presion) : '#E5E7EB' }}
                  />
                  {llanta.presion && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: psiColor(llanta.presion) }}>PSI</span>
                  )}
                </div>
                {errors.presion && <p className="text-xs text-red-500 mt-0.5">{errors.presion}</p>}
                {llanta.presion && (
                  <p className="text-xs mt-0.5" style={{ color: psiColor(llanta.presion) }}>
                    {parseFloat(llanta.presion) < 70 ? '⚠️ Muy baja — Riesgo reventón'
                      : parseFloat(llanta.presion) < 80 ? '⚠️ Baja — Revisar'
                      : parseFloat(llanta.presion) > 130 ? '⚠️ Alta — Liberar presión'
                      : '✓ Rango normal'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ─ S: ESTADO — auto-calculated, shown as preview ─ */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">
              Condición Visual → <span style={{ color: '#2563EB' }}>col S ESTADO</span> *
            </label>
            <div className="flex flex-col gap-2">
              {CONDICIONES.map(({ value, color, bg }) => (
                <button
                  key={value}
                  onClick={() => setLlanta((f) => ({ ...f, condicion: value }))}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all text-sm font-medium"
                  style={{
                    backgroundColor: llanta.condicion === value ? bg : '#FFFFFF',
                    borderColor:     llanta.condicion === value ? color : '#E5E7EB',
                    color:           llanta.condicion === value ? color : '#374151',
                  }}
                >
                  {value}
                  {llanta.condicion === value && <CheckCircle2 size={16} color={color} />}
                </button>
              ))}
            </div>
            {errors.condicion && <p className="text-xs text-red-500 mt-1">{errors.condicion}</p>}

            {/* ESTADO preview */}
            {llanta.condicion && (
              <div
                className="mt-2 flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold"
                style={{
                  backgroundColor: estadoMeta?.bg ?? '#F9FAFB',
                  borderColor: estadoMeta?.color ?? '#E5E7EB',
                  border: '1px solid',
                }}
              >
                <span style={{ color: '#6B7280' }}>Columna S → ESTADO:</span>
                <span style={{ color: estadoMeta?.color ?? '#374151' }}>{autoEstado}</span>
              </div>
            )}
          </div>

          {/* ─ Observaciones ─ */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1">Observaciones</label>
            <textarea
              value={llanta.observaciones}
              onChange={(e) => setLlanta((f) => ({ ...f, observaciones: e.target.value }))}
              placeholder="Cortes, bultos, mordidas, desgaste irregular, hora de reencauche..."
              rows={3}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-text bg-white text-sm resize-none"
            />
          </div>

          {/* ─ Critical warning ─ */}
          {(parseFloat(llanta.profundidad) < 5 || parseFloat(llanta.presion) < 70 || llanta.condicion === 'Cambio Urgente') && (
            <div className="flex items-start gap-2 p-3 rounded-xl" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertTriangle size={18} color="#DC2626" className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-700">Atención crítica</p>
                <p className="text-xs text-red-600">Notifica al Supervisor inmediatamente. No operar la unidad hasta revisión.</p>
              </div>
            </div>
          )}

          {/* ─ Buttons ─ */}
          <div className="flex gap-3 mt-1 pb-8">
            <button
              disabled={submitting}
              onClick={handleSubmit}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white"
              style={{ backgroundColor: '#162252' }}
            >
              {submitting
                ? <Loader2 size={18} className="animate-spin" />
                : <><Disc3 size={18} /> Registrar Llanta</>}
            </button>
            {registradas.length > 0 && (
              <button
                onClick={() => setStep('success')}
                className="px-5 py-3 rounded-xl font-semibold border"
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
