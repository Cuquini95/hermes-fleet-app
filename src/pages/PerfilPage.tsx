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
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { ROLE_LABELS } from '../types/roles';
import { isPrivateEvidenceUrl } from '../lib/evidence-link';

interface ActivityEntry {
  type: string;
  unit: string;
  date: string;
  time: string;
  folio: string;
  detail: string;
  row: string[];
  evidence?: string[];
}

interface PersonalHistory {
  records: ActivityEntry[];
  unavailable: string[];
}

async function readPersonalHistory(): Promise<PersonalHistory> {
  const response = await fetch('/hermes-api/api/profile/history', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudo consultar tu historial. Intenta de nuevo.');
  return response.json();
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

export default function PerfilPage() {
  const userId = useAuthStore((s) => s.userId);
  const project = useAuthStore((s) => s.project);
  return <Profile key={project + ':' + userId} userId={userId} />;
}

function Profile({ userId }: { userId: string }) {
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

  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [activity, setActivity] = useState<PersonalHistory | null>(null);

  const handleExport = useCallback(async () => {
    if (!userName) return;
    setExportLoading(true);
    setExportError(null);
    try {
      const data = await readPersonalHistory();
      if (useAuthStore.getState().userId !== userId) return;
      const payload = {
        exportado_por: userName,
        fecha_exportacion: new Date().toISOString(),
        registros: data.records,
        fuentes_no_disponibles: data.unavailable,
      };
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(payload, `hermes-mis-datos-${date}.json`);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Error al exportar datos');
    } finally {
      setExportLoading(false);
    }
  }, [userName, userId]);

  const handleToggleHistory = useCallback(async () => {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (!userName) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const history = await readPersonalHistory();
      if (useAuthStore.getState().userId === userId) setActivity(history);
    } catch (err: unknown) {
      setHistoryError(err instanceof Error ? err.message : 'Error al cargar historial');
    } finally {
      setHistoryLoading(false);
    }
  }, [historyOpen, userName, userId]);

  return (
    <div className="flex flex-col pb-4 gap-4 animate-fade-up">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Volver"
          onClick={() => navigate(-1)}
          className="min-h-12 min-w-12 p-2 rounded-xl bg-white border border-border shadow-sm"
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
        <h3 className="font-semibold text-text mb-2">Desempeño y certificaciones</h3>
        <p className="text-sm text-text-secondary">Pendiente de conectar los registros de Panamá.</p>
      </div>

      {/* ARCO: Exportar mis datos */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-blue-50 rounded-full p-2.5">
            <Shield size={20} className="text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-text">Mis datos</h3>
            <p className="text-text-secondary text-xs">Consulta y descarga de tus registros</p>
          </div>
        </div>
        <p className="text-xs text-text-secondary mb-3 leading-relaxed">
          Descarga en JSON los registros que tienen tu identidad confirmada. El archivo señala las fuentes que no respondieron.
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
            Consulta a Recursos Humanos de Panamá para actualizar tus datos.
          </p>
        </div>
      </div>

      {/* Historial de mis acciones */}
      <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
        <button
          type="button"
          onClick={handleToggleHistory}
          aria-expanded={historyOpen}
          aria-controls="profile-history"
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
          <div id="profile-history" className="border-t border-gray-100 px-4 pb-4">
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
                {activity.unavailable.length > 0 && (
                  <p role="status" className="text-xs text-text-secondary py-3">
                    Fuentes sin verificar: {activity.unavailable.join(', ')}.
                  </p>
                )}
                {activity.records.length === 0 ? (
                  <p className="text-xs text-text-secondary py-3">
                    No se encontraron registros con tu identidad en las fuentes que respondieron.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 mt-3">
                    {activity.records.slice(0, 30).map((entry, i) => (
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
                            {[entry.unit, entry.folio, entry.detail].filter(Boolean).join(' · ')}
                          </p>
                          <p className="text-xs text-text-secondary mt-0.5">{entry.date} {entry.time}</p>
                          {entry.evidence?.filter(isPrivateEvidenceUrl).map((url, index) => (
                            <a key={url} href={url} target="_blank" rel="noreferrer" className="mr-2 inline-block py-1 text-xs font-semibold text-amber underline">
                              {`Ver evidencia ${index + 1}`}
                            </a>
                          ))}
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
