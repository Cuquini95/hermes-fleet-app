/**
 * @fileoverview Monolithic by design (> 400 LOC).
 * Work-order detail: tasks, parts, signatures, photos in one timeline view.
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Wrench, ChevronRight } from 'lucide-react';
import { useWorkOrderStore, orderHistoryTime } from '../stores/workorder-store';
import { useAuthStore } from '../stores/auth-store';
import { useEquipmentById } from '../hooks/useEquipmentList';
import { PRIORITY_CONFIG, ESTADO_CONFIG, getNextStatuses } from '../types/workorder';
import type { OTEstado, OTStatusField, StatusLogEntry } from '../types/workorder';
import { photoUrls } from '../lib/averias';
import { requestWorkshop, mechanicCoversUnit, type WorkshopMechanic } from '../lib/workshop-api';
import { uploadPhoto } from '../lib/photo-upload';
import PhotoCapture from '../components/ui/PhotoCapture';

const FIELD_LABELS: Record<StatusLogEntry['field'], string> = {
  estado: 'Estado',
  mecanico_asignado: 'Mecánico',
  progreso: 'Progreso',
  observaciones: 'Observaciones',
  costo_estimado: 'Costo estimado',
  prioridad: 'Prioridad',
  foto_url: 'Evidencia',
  programacion: 'Programación',
};

const ASSIGN = ['jefe_taller', 'coordinador', 'gerencia'];
const CLOSE = ['jefe_taller', 'supervisor', 'gerencia'];
const UPDATE = [...ASSIGN, 'supervisor', 'mecanico'];

function canEditField(role: string | null, field: OTStatusField): boolean {
  if (!role) return false;
  return (['mecanico_asignado', 'costo_estimado', 'prioridad'].includes(field) ? ASSIGN : UPDATE).includes(role);
}

function StatusPillRow({ current }: { current: OTEstado }) {
  const allStatuses: OTEstado[] = [current === 'En Espera de Asignación' ? current : 'Abierta', 'En Reparación', 'Esperando Pieza', 'Resuelta', 'Completado'];
  const currentIdx = allStatuses.indexOf(current);

  return (
    <div className="flex flex-wrap gap-1.5">
      {allStatuses.map((s, idx) => {
        const isCurrent = s === current;
        const isPast = idx < currentIdx;
        const config = ESTADO_CONFIG[s];
        return (
          <span
            key={s}
            className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap shrink-0"
            style={{
              color: isCurrent ? '#fff' : isPast ? config.color : '#9CA3AF',
              backgroundColor: isCurrent ? config.color : isPast ? config.bg : '#F3F4F6',
            }}
          >
            {s}
          </span>
        );
      })}
    </div>
  );
}

function TimelineEntry({ entry }: { entry: StatusLogEntry }) {
  const label = FIELD_LABELS[entry.field] ?? entry.field;
  return (
    <div className="flex gap-3 py-2.5 border-b border-gray-100 last:border-0">
      <div className="flex flex-col items-center shrink-0 pt-0.5">
        <div className="w-2 h-2 rounded-full bg-amber" />
        <div className="flex-1 w-px bg-gray-200 mt-1" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text">
          {label}: <span className="text-text-secondary">{entry.field === 'foto_url' ? '' : entry.old_value || '(vacío)'}</span>
          {' '}<ChevronRight size={12} className="inline text-text-secondary" />{' '}
          <span className="text-amber font-semibold break-words">{entry.field === 'foto_url' ? 'Evidencia adjuntada' : entry.new_value}</span>
        </p>
        <p className="text-xs text-text-secondary mt-0.5">
          {entry.changed_by} &middot; {entry.role} &middot; {entry.timestamp}
        </p>
      </div>
    </div>
  );
}

export default function WorkOrderDetailPage() {
  const { otId } = useParams<{ otId: string }>();
  const navigate = useNavigate();
  const { statusLog, loading, error, fetched, fetchWorkOrders, updateOTField, getWorkOrderById } = useWorkOrderStore();
  const role = useAuthStore((s) => s.role);


  const [editEstado, setEditEstado] = useState('');
  const [editMecanico, setEditMecanico] = useState('');
  const [editCosto, setEditCosto] = useState('');
  const [editNotas, setEditNotas] = useState('');
  const [saving, setSaving] = useState<OTStatusField | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mechanics, setMechanics] = useState<WorkshopMechanic[]>([]);
  const [mechanicsError, setMechanicsError] = useState('');
  const [evidence, setEvidence] = useState<{ file: File; preview: string }[]>([]);
  const uploaded = useRef(new Map<File, string>());
  const submitting = useRef(false);

  useEffect(() => {
    if (!fetched) {
      fetchWorkOrders();
    }
  }, [fetched, fetchWorkOrders]);

  const wo = otId ? getWorkOrderById(otId) : undefined;
  const equipment = useEquipmentById(wo?.unidad ?? '');

  useEffect(() => {
    if (!canEditField(role, 'mecanico_asignado')) return;
    let active = true;
    requestWorkshop<{ mechanics: WorkshopMechanic[] }>('mechanics')
      .then(({ mechanics }) => { if (active) setMechanics(mechanics); })
      .catch((err: unknown) => { if (active) setMechanicsError(err instanceof Error ? err.message : 'Padrón no disponible'); });
    return () => { active = false; };
  }, [role]);

  // Initialize edit fields when workorder loads
  useEffect(() => {
    if (wo) {
      setEditEstado(wo.estado);
      setEditMecanico(wo.mecanico_usuario_id || '');
      setEditCosto(String(wo.costo_estimado || ''));
      setEditNotas(wo.observaciones);
    }
  }, [wo?.ot_id, wo?.estado, wo?.mecanico_usuario_id, wo?.costo_estimado, wo?.observaciones]);

  const otLog = statusLog
    .filter((e) => e.ot_id === otId)
    .sort((a, b) => orderHistoryTime(b.timestamp) - orderHistoryTime(a.timestamp));

  async function handleSave(field: OTStatusField, value: string) {
    if (!otId || !wo || submitting.current) return;
    submitting.current = true;
    setSaving(field);
    setSaveError(null);
    try {
      if (field === 'foto_url') {
        const urls = [];
        for (const { file } of evidence) {
          const url = uploaded.current.get(file) ?? await uploadPhoto(file, 'falla-photos');
          uploaded.current.set(file, url);
          urls.push(url);
        }
        await updateOTField(otId, field, urls);
        evidence.forEach(({ preview }) => URL.revokeObjectURL(preview));
        setEvidence([]);
        uploaded.current.clear();
      } else {
        await updateOTField(otId, field, value);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      setSaveError(msg);
    } finally {
      submitting.current = false;
      setSaving(null);
    }
  }

  if (loading && !fetched) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-amber border-t-transparent" />
      </div>
    );
  }

  if (!wo) {
    return (
      <div className="py-4">
        <div className="flex items-center gap-3 mb-4">
          <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white border border-border shadow-sm">
            <ArrowLeft size={20} className="text-text" />
          </button>
          <h1 className="text-xl font-bold text-text">{error ? 'Taller no disponible' : 'OT no encontrada'}</h1>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border text-center">
          <p className="text-text-secondary">{error ?? `La orden ${otId} no está disponible en esta sesión.`}</p>
          <button type="button" onClick={() => void fetchWorkOrders()} className="mt-3 text-sm font-medium text-amber">Actualizar</button>
        </div>
      </div>
    );
  }

  const prioKey = wo.prioridad?.toUpperCase() as keyof typeof PRIORITY_CONFIG;
  const priorityConfig = PRIORITY_CONFIG[prioKey] ?? { color: '#6B7280', bg: '#F3F4F6', label: wo.prioridad, time: '' };
  const canEdit = wo.estado !== 'Completado' && role !== null && UPDATE.includes(role);
  const nextStatuses = getNextStatuses(wo.estado).filter((state) => state !== 'Completado' || (role && CLOSE.includes(role)));
  const unitMechanics = mechanics.filter((mechanic) => mechanicCoversUnit(mechanic, wo.unidad));
  const photos = photoUrls(wo.foto_url);

  return (
    <div className="flex flex-col gap-4 pb-6 animate-fade-up">
      {saveError && (
        <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {saveError}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white border border-border shadow-sm">
          <ArrowLeft size={20} className="text-text" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-text truncate">{wo.ot_id}</h1>
          <p className="text-xs text-text-secondary">{wo.fecha}</p>
          {wo.fecha_cierre && <p className="text-xs text-text-secondary">Cierre {wo.fecha_cierre}</p>}
        </div>
        {priorityConfig && (
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
            style={{ color: priorityConfig.color, backgroundColor: priorityConfig.bg }}
          >
            {priorityConfig.label}
          </span>
        )}
      </div>

      {/* Status flow */}
      <div className="bg-white rounded-xl p-3 shadow-sm border border-border">
        <StatusPillRow current={wo.estado} />
      </div>

      {/* Info card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-text-secondary">Unidad</p>
            <p className="text-sm font-semibold text-text">{wo.unidad}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Modelo</p>
            <p className="text-sm font-semibold text-text">{equipment?.model ?? '-'}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Tipo</p>
            <p className="text-sm font-semibold text-text">{wo.tipo_averia}</p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Prioridad</p>
            <p className="text-sm font-semibold" style={{ color: priorityConfig?.color }}>
              {priorityConfig?.label ?? wo.prioridad}
            </p>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Mecanico</p>
            <div className="flex items-center gap-1">
              <Wrench size={12} className="text-text-secondary" />
              <p className="text-sm font-semibold text-text">
                {wo.mecanico_asignado || 'Sin asignar'}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs text-text-secondary">Progreso</p>
            <p className="text-sm font-semibold text-text">{wo.progreso}%</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-text-secondary mb-1">Descripcion</p>
          <p className="text-sm text-text break-words">{wo.descripcion}</p>
        </div>

        {wo.partes_necesarias && (
          <div>
            <p className="text-xs text-text-secondary mb-1">Partes necesarias</p>
            <p className="text-sm text-text">{wo.partes_necesarias}</p>
          </div>
        )}

        {wo.costo_estimado > 0 && (
          <div>
            <p className="text-xs text-text-secondary mb-1">Costo estimado</p>
            <p className="text-sm font-semibold text-text">${wo.costo_estimado.toLocaleString()}</p>
          </div>
        )}

        {photos.length > 0 && (
          <div>
            <p className="text-xs text-text-secondary mb-1">Fotos</p>
            <div className="flex gap-2 overflow-x-auto">
              {photos.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Foto ${i + 1}`}
                  className="w-20 h-20 rounded-lg object-cover border border-border"
                />
              ))}
            </div>
          </div>
        )}

        {wo.observaciones && (
          <div>
            <p className="text-xs text-text-secondary mb-1">Observaciones</p>
            <p className="text-sm text-text">{wo.observaciones}</p>
          </div>
        )}
      </div>

      {/* Edit panel */}
      {canEdit && (
        <fieldset disabled={!!saving} aria-busy={!!saving} className="min-w-0 bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">
          <h3 className="text-sm font-bold text-text">Actualizar OT</h3>

          {/* Status */}
          {canEditField(role, 'estado') && nextStatuses.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Estado</label>
              <div className="flex gap-2">
                <select
                  value={editEstado}
                  onChange={(e) => setEditEstado(e.target.value)}
                  className="flex-1 min-w-0 rounded-xl border border-border p-2.5 text-sm bg-white text-text"
                >
                  {nextStatuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={editEstado === wo.estado || !!saving}
                  onClick={() => handleSave('estado', editEstado)}
                  className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium disabled:opacity-40"
                >
                  {saving === 'estado' ? '...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {/* Mechanic */}
          {canEditField(role, 'mecanico_asignado') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Mecanico asignado</label>
              <div className="flex gap-2">
                <select
                  aria-label="Mecánico asignado"
                  value={editMecanico}
                  onChange={(e) => setEditMecanico(e.target.value)}
                  className="flex-1 min-w-0 rounded-xl border border-border p-2.5 text-sm bg-white text-text"
                >
                  <option value="">Selecciona mecánico</option>
                  {unitMechanics.map(({ userId, userName }) => <option key={userId} value={userId}>{userName}</option>)}
                </select>
                <button
                  type="button"
                  disabled={!editMecanico || editMecanico === wo.mecanico_usuario_id || !!saving}
                  onClick={() => handleSave('mecanico_asignado', editMecanico)}
                  className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium disabled:opacity-40"
                >
                  {saving === 'mecanico_asignado' ? '…' : wo.mecanico_asignado ? 'Reasignar' : 'Asignar'}
                </button>
              </div>
            </div>
          )}

          {canEditField(role, 'mecanico_asignado') && mechanicsError && <p role="alert" className="text-sm text-red-700">{mechanicsError}</p>}

          {/* Progress */}
          {canEditField(role, 'progreso') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Progreso</label>
              <div className="flex gap-2">
                {[0, 25, 50, 75, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    disabled={!!saving || wo.progreso === val}
                    onClick={() => handleSave('progreso', String(val))}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                      wo.progreso === val
                        ? 'bg-amber text-white'
                        : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Cost */}
          {canEditField(role, 'costo_estimado') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Costo estimado ($)</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editCosto}
                  onChange={(e) => setEditCosto(e.target.value)}
                  className="flex-1 min-w-0 rounded-xl border border-border p-2.5 text-sm bg-white text-text"
                  placeholder="0"
                />
                <button
                  type="button"
                  disabled={editCosto === String(wo.costo_estimado || '') || !!saving || !editCosto}
                  onClick={() => handleSave('costo_estimado', editCosto)}
                  className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium disabled:opacity-40"
                >
                  {saving === 'costo_estimado' ? '...' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          {canEditField(role, 'observaciones') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Observaciones</label>
              <textarea
                value={editNotas}
                onChange={(e) => setEditNotas(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-border p-2.5 text-sm text-text resize-none bg-white"
                placeholder="Notas adicionales..."
              />
              <button
                type="button"
                disabled={editNotas === wo.observaciones || !!saving}
                onClick={() => handleSave('observaciones', editNotas)}
                className="w-full py-2.5 bg-amber text-white rounded-xl text-sm font-medium disabled:opacity-40"
              >
                {saving === 'observaciones' ? '...' : 'Guardar notas'}
              </button>
            </div>
          )}
          {canEditField(role, 'foto_url') && (
            <fieldset disabled={!!saving} className="min-w-0 flex flex-col gap-2">
              <legend className="text-xs font-medium text-text-secondary mb-2">Evidencia de la reparación</legend>
              <PhotoCapture
                photos={evidence}
                onCapture={(file) => setEvidence((list) => [...list, { file, preview: URL.createObjectURL(file) }])}
                onRemove={(index) => setEvidence((list) => {
                  if (list[index]) URL.revokeObjectURL(list[index].preview);
                  return list.filter((_, i) => i !== index);
                })}
                multiple
              />
              {evidence.length > 0 && (
                <button type="button" onClick={() => handleSave('foto_url', '')} className="w-full py-2.5 bg-amber text-white rounded-xl text-sm font-medium">
                  {saving === 'foto_url' ? 'Guardando…' : 'Guardar evidencia'}
                </button>
              )}
            </fieldset>
          )}
        </fieldset>
      )}

      {/* Timeline */}
      {otLog.length > 0 && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-amber" />
            <h3 className="text-sm font-bold text-text">Historial</h3>
          </div>
          <div className="flex flex-col">
            {otLog.map((entry, i) => (
              <TimelineEntry key={`${entry.timestamp}-${i}`} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
