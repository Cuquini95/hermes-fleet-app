/**
 * @fileoverview Monolithic by design (> 400 LOC).
 * Profile/settings surface with multiple independent sections sharing auth-store state.
 */
import { useNavigate, Link } from 'react-router-dom';
import { useState, useCallback } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  History,
  Loader2,
  Shield,
  Trophy,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { ROLE_LABELS } from '../types/roles';

interface ScoreCategory {
  label: string;
  score: number;
  max: number;
}

interface Certification {
  name: string;
  expiry: string;
  status: 'vigente' | 'vencido';
}

interface ActivityEntry {
  type: string;
  date: string;
  detail: string;
}

const SCORE_CATEGORIES: ScoreCategory[] = [
  { label: 'Inspecciones', score: 18, max: 20 },
  { label: 'Condición Equipo', score: 22, max: 25 },
  { label: 'Combustible', score: 13, max: 15 },
  { label: 'Horas', score: 19, max: 20 },
  { label: 'Seguridad', score: 6, max: 20 },
];

const CERTIFICATIONS: Certification[] = [
  { name: 'DC-3 STPS', expiry: '15 Sep 2026', status: 'vigente' },
  { name: 'Operación Equipo Pesado', expiry: '3 Mar 2027', status: 'vigente' },
];

const totalScore = SCORE_CATEGORIES.reduce((sum, c) => sum + c.score, 0);
const totalMax = SCORE_CATEGORIES.reduce((sum, c) => sum + c.max, 0);

const EXPORT_TABS = [
  { key: SHEET_TABS.INSPECCIONES, label: 'Inspecciones DVIR' },
  { key: SHEET_TABS.AVERIAS, label: 'Fallas reportadas' },
  { key: SHEET_TABS.COMBUSTIBLE, label: 'Diesel' },
  { key: SHEET_TABS.HOROMETROS, label: 'Horómetros' },
  { key: SHEET_TABS.FLETES, label: 'Viajes' },
  { key: SHEET_TABS.GASTOS, label: 'Gastos' },
] as const;

async function fetchUserData(userName: string): Promise<Record<string, string[][]>> {
  const results: Record<string, string[][]> = {};
  const nameLower = userName.trim().toLowerCase();

  await Promise.allSettled(
    EXPORT_TABS.map(async ({ key, label }) => {
      try {
        const rows = await readRange(key);
        results[label] = rows.filter(
          (row) => (row[2] ?? '').trim().toLowerCase() === nameLower,
        );
      } catch {
        results[label] = [];
      }
    }),
  );

  return results;
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function fetchRecentActivity(userName: string): Promise<ActivityEntry[]> {
  const entries: ActivityEntry[] = [];
  const nameLower = userName.trim().toLowerCase();

  const sources = [
    { tab: SHEET_TABS.INSPECCIONES, type: 'DVIR' },
    { tab: SHEET_TABS.AVERIAS, type: 'Falla' },
    { tab: SHEET_TABS.COMBUSTIBLE, type: 'Diesel' },
    { tab: SHEET_TABS.HOROMETROS, type: 'Horómetro' },
    { tab: SHEET_TABS.FLETES, type: 'Viaje' },
  ] as const;

  await Promise.allSettled(
    sources.map(async ({ tab, type }) => {
      try {
        const rows = await readRange(tab);
        for (const row of rows) {
          if ((row[2] ?? '').trim().toLowerCase() === nameLower) {
            entries.push({ type, date: row[0] ?? '', detail: row[3] ?? '' });
          }
        }
      } catch {
        // Tab unavailable — skip silently
      }
    }),
  );

  entries.sort((a, b) => b.date.localeCompare(a.date));
  return entries.slice(0, 30);
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-amber' : 'bg-critical';

  return (
    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function PerfilPage() {
  const navigate = useNavigate();

  const userName = useAuthStore((s) => s.userName);
  const role = useAuthStore((s) => s.role);
  const assignedUnits = useAuthStore((s) => s.assignedUnits);

  const roleLabel = role ? ROLE_LABELS[role] : 'Sin rol';
  const initials =
    (userName ?? '')
      .split(' ')
      .map((n) => n[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';
  const unitLabel = assignedUnits.length > 0 ? assignedUnits[0] : '';

  const overallPct = Math.round((totalScore / totalMax) * 100);
  const arcColor = overallPct >= 80 ? '#16A34A' : overallPct >= 50 ? '#2563EB' : '#DC2626';

  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[] | null>(null);

  const handleExport = useCallback(async () => {
    if (!userName) return;
    setExportLoading(true);
    setExportError(null);
    try {
      const data = await fetchUserData(userName);
      const payload = {
        exportado_por: userName,
        fecha_exportacion: new Date().toISOString(),
        nota: 'Datos exportados en ejercicio del derecho de Acceso (ARCO) — LFPDPPP',
        registros: data,
      };
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(payload, `hermes-mis-datos-${date}.json`);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Error al exportar datos');
    } finally {
      setExportLoading(false);
    }
  }, [userName]);

  const handleToggleHistory = useCallback(async () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (activity !== null) return;
    if (!userName) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const entries = await fetchRecentActivity(userName);
      setActivity(entries);
    } catch (err: unknown) {
      setHistoryError(err instanceof Error ? err.message : 'Error al cargar historial');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyOpen, activity, userName]);

  return (
    <div className="flex flex-col pb-4 gap-4 animate-fade-up">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Mi Perfil</h1>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-border flex flex-col items-center gap-3">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md"
          style={{ backgroundColor: '#2563EB' }}
        >
          {initials}
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text">{userName}</h2>
          <p className="text-text-secondary mt-0.5">{roleLabel}</p>
          {unitLabel && <p className="text-sm text-amber font-medium mt-1">{unitLabel}</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-border">
        <h3 className="font-semibold text-text mb-4">Desempeño</h3>
        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#E5E7EB" strokeWidth="8" />
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke={arcColor}
                strokeWidth="8"
                strokeDasharray={`${overallPct * 2.01} 201`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="text-lg font-bold text-text"
                style={{ transform: 'rotate(90deg) translateX(2px)' }}
              >
                {overallPct}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-text">
              {totalScore}/{totalMax}
            </p>
            <p className="text-text-secondary text-sm">Puntuación total</p>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          {SCORE_CATEGORIES.map((cat) => (
            <div key={cat.label} className="flex items-center gap-3">
              <span className="text-sm text-text w-36 shrink-0">{cat.label}</span>
              <ScoreBar score={cat.score} max={cat.max} />
              <span className="text-sm font-semibold text-text w-12 text-right shrink-0">
                {cat.score}/{cat.max}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex items-center gap-3">
        <div className="bg-amber/10 rounded-full p-3">
          <Trophy size={24} className="text-amber" />
        </div>
        <div>
          <p className="font-semibold text-text">Posición en ranking</p>
          <p className="text-text-secondary text-sm">3° de 15 operadores</p>
        </div>
        <div className="ml-auto text-3xl font-bold text-amber">#3</div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-border">
        <h3 className="font-semibold text-text mb-3">Certificaciones</h3>
        <div className="flex flex-col gap-3">
          {CERTIFICATIONS.map((cert) => (
            <div
              key={cert.name}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
            >
              <div>
                <p className="font-medium text-text text-sm">{cert.name}</p>
                <p className="text-text-secondary text-xs mt-0.5">Vence: {cert.expiry}</p>
              </div>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  cert.status === 'vigente'
                    ? 'bg-green-100 text-success'
                    : 'bg-red-100 text-critical'
                }`}
              >
                {cert.status === 'vigente' ? 'Vigente' : 'Vencido'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ARCO: Exportar mis datos */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-blue-50 rounded-full p-2.5">
            <Shield size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-text">Mis Datos (ARCO)</h3>
            <p className="text-text-secondary text-xs">Derecho de acceso — LFPDPPP</p>
          </div>
        </div>
        <p className="text-xs text-text-secondary mb-3 leading-relaxed">
          Descarga todos tus registros en formato JSON. Incluye DVIRs, fallas, diesel,
          horómetros, viajes y gastos asociados a tu usuario.
        </p>
        {exportError && <p className="text-xs text-red-600 mb-2">{exportError}</p>}
        <button
          type="button"
          onClick={handleExport}
          disabled={exportLoading}
          className="flex items-center gap-2 w-full justify-center py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75 disabled:opacity-50"
          style={{ backgroundColor: '#2563EB' }}
        >
          {exportLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Exportando...
            </>
          ) : (
            <>
              <Download size={16} /> Exportar mis datos
            </>
          )}
        </button>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-text-secondary">
            Para rectificación, cancelación u oposición escribe a{' '}
            <a href="mailto:privacidad@transplus.mx" className="text-blue-600 underline">
              privacidad@transplus.mx
            </a>
          </p>
        </div>
      </div>

      {/* Historial de mis acciones */}
      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <button
          type="button"
          onClick={handleToggleHistory}
          className="flex items-center gap-3 w-full p-4 text-left hover:bg-gray-50 transition-colors"
        >
          <div className="bg-gray-100 rounded-full p-2.5 shrink-0">
            <History size={20} className="text-gray-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-text">Historial de mis acciones</p>
            <p className="text-text-secondary text-xs">Últimos 30 registros en el sistema</p>
          </div>
          {historyOpen ? (
            <ChevronUp size={18} className="text-gray-400 shrink-0" />
          ) : (
            <ChevronDown size={18} className="text-gray-400 shrink-0" />
          )}
        </button>
        {historyOpen && (
          <div className="border-t border-gray-100 px-4 pb-4">
            {historyLoading && (
              <div className="flex items-center gap-2 py-4 text-text-secondary text-sm">
                <Loader2 size={16} className="animate-spin" /> Cargando historial...
              </div>
            )}
            {historyError && (
              <p className="text-xs text-red-600 py-3">{historyError}</p>
            )}
            {!historyLoading && !historyError && activity !== null && (
              <>
                {activity.length === 0 ? (
                  <p className="text-xs text-text-secondary py-3">
                    No se encontraron registros para tu usuario.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 mt-3">
                    {activity.map((entry, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 p-2.5 bg-gray-50 rounded-xl"
                      >
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                          style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}
                        >
                          {entry.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-text truncate">
                            {entry.detail || '—'}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">{entry.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Legal links */}
      <div className="flex items-center justify-center gap-4 py-1">
        <Link
          to="/privacy"
          className="text-xs text-text-secondary underline hover:text-text transition-colors"
        >
          Aviso de Privacidad
        </Link>
        <span className="text-xs text-gray-300">&middot;</span>
        <Link
          to="/terms"
          className="text-xs text-text-secondary underline hover:text-text transition-colors"
        >
          Términos de Uso
        </Link>
      </div>
    </div>
  );
}
