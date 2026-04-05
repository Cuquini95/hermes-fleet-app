import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Wrench, ChevronRight } from 'lucide-react';
import { useWorkOrderStore } from '../stores/workorder-store';
import { useAuthStore } from '../stores/auth-store';
import { getEquipmentById } from '../data/equipment-catalog';
import { PRIORITY_CONFIG, ESTADO_CONFIG, getNextStatuses } from '../types/workorder';
import type { OTEstado, OTStatusField, StatusLogEntry } from '../types/workorder';

const FIELD_LABELS: Record<OTStatusField, string> = {
  estado: 'Estado',
  mecanico_asignado: 'Mecánico',
  progreso: 'Progreso',
  observaciones: 'Observaciones',
  costo_estimado: 'Costo estimado',
  prioridad: 'Prioridad',
};

function canEditField(role: string | null, field: OTStatusField): boolean {
  if (role === 'jefe_taller' || role === 'coordinador' || role === 'gerencia' || role === 'supervisor') {
    return ['estado', 'mecanico_asignado', 'costo_estimado', 'progreso', 'observaciones', 'prioridad'].includes(field);
  }
  if (role === 'mecanico') {
    return field === 'progreso' || field === 'observaciones';
  }
  return false;
}

function StatusPillRow({ current }: { current: OTEstado }) {
  const allStatuses: OTEstado[] = ['Nuevo', 'Asignado', 'En Proceso', 'Esperando Pieza', 'Completado'];
  const currentIdx = allStatuses.indexOf(current);

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
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
          {label}: <span className="text-text-secondary">{entry.old_value || '(vacío)'}</span>
          {' '}<ChevronRight size={12} className="inline text-text-secondary" />{' '}
          <span className="text-amber font-semibold">{entry.new_value}</span>
        </p>
        <p className="text-xs text-text-secondary mt-0.5">
          {entry.changed_by} &middot; {entry.timestamp}
        </p>
      </div>
    </div>
  );
}

export default function WorkOrderDetailPage() {
  const { otId } = useParams<{ otId: string }>();
  const navigate = useNavigate();
  const { statusLog, loading, fetched, fetchWorkOrders, updateOTField, getWorkOrderById } = useWorkOrderStore();
  const role = useAuthStore((s) => s.role);
  const userName = useAuthStore((s) => s.userName);

  const [editEstado, setEditEstado] = useState('');
  const [editMecanico, setEditMecanico] = useState('');
  const [editCosto, setEditCosto] = useState('');
  const [editNotas, setEditNotas] = useState('');
  const [saving, setSaving] = useState<OTStatusField | null>(null);

  useEffect(() => {
    if (!fetched) {
      fetchWorkOrders();
    }
  }, [fetched, fetchWorkOrders]);

  const wo = otId ? getWorkOrderById(otId) : undefined;
  const equipment = wo ? getEquipmentById(wo.unidad) : undefined;

  // Initialize edit fields when workorder loads
  useEffect(() => {
    if (wo) {
      setEditEstado(wo.estado);
      setEditMecanico(wo.mecanico_asignado);
      setEditCosto(String(wo.costo_estimado || ''));
      setEditNotas(wo.observaciones);
    }
  }, [wo?.ot_id, wo?.estado, wo?.mecanico_asignado, wo?.costo_estimado, wo?.observaciones]);

  const otLog = statusLog
    .filter((e) => e.ot_id === otId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  async function handleSave(field: OTStatusField, value: string) {
    if (!otId || !wo) return;
    setSaving(field);
    await updateOTField(otId, field, value, userName, role ?? '');
    setSaving(null);
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
          <h1 className="text-xl font-bold text-text">OT no encontrada</h1>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-border text-center">
          <p className="text-text-secondary">No se encontro la orden de trabajo {otId}</p>
        </div>
      </div>
    );
  }

  const priorityConfig = PRIORITY_CONFIG[wo.prioridad];
  const canEdit = role === 'jefe_taller' || role === 'coordinador' || role === 'mecanico' || role === 'gerencia' || role === 'supervisor';
  const nextStatuses = getNextStatuses(wo.estado);

  return (
    <div className="flex flex-col gap-4 pb-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-2 rounded-xl bg-white border border-border shadow-sm">
          <ArrowLeft size={20} className="text-text" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-text truncate">{wo.ot_id}</h1>
          <p className="text-xs text-text-secondary">{wo.fecha}</p>
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
          <p className="text-sm text-text">{wo.descripcion}</p>
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

        {wo.foto_url && (
          <div>
            <p className="text-xs text-text-secondary mb-1">Fotos</p>
            <div className="flex gap-2 overflow-x-auto">
              {wo.foto_url.split(',').filter(Boolean).map((url, i) => (
                <img
                  key={i}
                  src={url.trim()}
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
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex flex-col gap-4">
          <h3 className="text-sm font-bold text-text">Actualizar OT</h3>

          {/* Status */}
          {canEditField(role, 'estado') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Estado</label>
              <div className="flex gap-2">
                <select
                  value={editEstado}
                  onChange={(e) => setEditEstado(e.target.value)}
                  className="flex-1 rounded-xl border border-border p-2.5 text-sm bg-white text-text"
                >
                  {nextStatuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={editEstado === wo.estado || saving === 'estado'}
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
                <input
                  type="text"
                  value={editMecanico}
                  onChange={(e) => setEditMecanico(e.target.value)}
                  className="flex-1 rounded-xl border border-border p-2.5 text-sm bg-white text-text"
                  placeholder="Nombre del mecanico"
                />
                <button
                  type="button"
                  disabled={editMecanico === wo.mecanico_asignado || saving === 'mecanico_asignado'}
                  onClick={() => handleSave('mecanico_asignado', editMecanico)}
                  className="px-4 py-2 bg-amber text-white rounded-xl text-sm font-medium disabled:opacity-40"
                >
                  {saving === 'mecanico_asignado' ? '...' : 'Reasignar'}
                </button>
              </div>
            </div>
          )}

          {/* Progress */}
          {canEditField(role, 'progreso') && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-text-secondary">Progreso</label>
              <div className="flex gap-2">
                {[0, 25, 50, 75, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    disabled={saving === 'progreso'}
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
                  value={editCosto}
                  onChange={(e) => setEditCosto(e.target.value)}
                  className="flex-1 rounded-xl border border-border p-2.5 text-sm bg-white text-text"
                  placeholder="0"
                />
                <button
                  type="button"
                  disabled={editCosto === String(wo.costo_estimado || '') || saving === 'costo_estimado'}
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
                disabled={editNotas === wo.observaciones || saving === 'observaciones'}
                onClick={() => handleSave('observaciones', editNotas)}
                className="w-full py-2.5 bg-amber text-white rounded-xl text-sm font-medium disabled:opacity-40"
              >
                {saving === 'observaciones' ? '...' : 'Guardar notas'}
              </button>
            </div>
          )}
        </div>
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
