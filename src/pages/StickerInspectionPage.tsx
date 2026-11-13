import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  ClipboardCheck,
  FileText,
  ShieldCheck,
  WifiOff,
} from 'lucide-react';
import { STICKER_INSPECTION_TEMPLATES, getStickerTemplate, stickerTemplateForEquipment } from '../data/sticker-inspection-templates';
import type {
  EquipmentInspectionClass,
  StickerColor,
  StickerInspectionItem,
  StickerInspectionStatus,
} from '../types/sticker-inspection';
import {
  addDaysToInputDate,
  colorClass,
  colorLabel,
  evaluateStickerInspection,
} from '../lib/sticker-inspection';
import { printSticker } from '../lib/sticker-print';
import { mexicoDateInput, mexicoTimeInput } from '../lib/date-utils';
import { saveWorkshopCapture } from '../lib/offline-queue';
import { requestWorkshop, WorkshopApiError } from '../lib/workshop-api';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { useAuthStore } from '../stores/auth-store';
import PhotoCapture from '../components/ui/PhotoCapture';
import SuccessToast, { type ToastType } from '../components/ui/SuccessToast';

interface PhotoItem {
  file: File;
  preview: string;
}

interface ItemResponse {
  status: StickerInspectionStatus | null;
  comment: string;
  dueDate: string;
  canOperate: boolean;
  photos: PhotoItem[];
}

interface StickerRecord {
  folio: string;
  color: StickerColor;
  unitId: string;
  company: string;
  inspectionDate: string;
  expiryDate: string;
  inspector: string;
  supervisor: string;
  qrText: string;
  findingsSummary: string;
  approvalState: string;
  canDispatch: boolean;
  photos: string[];
  findings: StickerFindingRecord[];
}

interface StickerFindingRecord {
  itemId: string;
  section: string;
  label: string;
  status: StickerInspectionStatus;
  comment: string;
  dueDate: string;
  canOperate: boolean;
  hardStop: boolean;
  photos: string[];
}

const COMPANY_DEFAULT = 'Trans Plus Panamá';
const COLORS: StickerColor[] = ['green', 'yellow', 'red'];
const STATUS_OPTIONS: { value: StickerInspectionStatus; label: string }[] = [
  { value: 'cumple', label: 'Cumple' },
  { value: 'condicionado', label: 'Cond.' },
  { value: 'no_cumple', label: 'No cumple' },
  { value: 'no_aplica', label: 'N/A' },
];

function buildInitialResponses(items: StickerInspectionItem[], baseDate: string): Record<string, ItemResponse> {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        status: null,
        comment: '',
        dueDate: addDaysToInputDate(baseDate, item.defaultDueDays ?? 15),
        canOperate: item.hardStop ? false : true,
        photos: [],
      },
    ]),
  );
}

function hasEvidenceGap(items: StickerInspectionItem[], responses: Record<string, ItemResponse>): boolean {
  return items.some((item) => {
    const response = responses[item.id];
    if (!response || response.status === null) return true;
    if (response.status !== 'condicionado' && response.status !== 'no_cumple') return false;
    if (response.comment.trim() === '') return true;
    if (response.photos.length === 0) return true;
    return response.status === 'condicionado' && response.dueDate.trim() === '';
  });
}

export default function StickerInspectionPage() {
  const navigate = useNavigate();
  const equipment = useEquipmentList();
  const isOnline = useOnlineStatus();
  const role = useAuthStore((s) => s.role);
  const project = useAuthStore((s) => s.project);
  const hseReviewer = useAuthStore((s) => s.canReviewPanamaHse);
  const canSupervisorApprove = (role === 'supervisor' || role === 'gerencia') && (project !== 'tmf-panama' || hseReviewer);
  const canApproveAtCapture = project !== 'tmf-panama' && canSupervisorApprove;

  const [fecha, setFecha] = useState(mexicoDateInput());
  const [hora, setHora] = useState(mexicoTimeInput());
  const [company, setCompany] = useState(COMPANY_DEFAULT);
  const [unitId, setUnitId] = useState('');
  const [templateId, setTemplateId] = useState<EquipmentInspectionClass>('camion_articulado');
  const selectedUnit = equipment.find(item => item.unit_id === unitId);
  const suggestedTemplate = project === 'tmf-panama' && selectedUnit
    ? stickerTemplateForEquipment(selectedUnit.type, selectedUnit.model) : '';
  const template = useMemo(() => getStickerTemplate(templateId), [templateId]);
  const [responses, setResponses] = useState<Record<string, ItemResponse>>(() => buildInitialResponses(template.items, fecha));
  const [finalColor, setFinalColor] = useState<StickerColor>('green');
  const [overrideReason, setOverrideReason] = useState('');
  const [supervisorApproval, setSupervisorApproval] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pending, setPending] = useState('');
  const captureId = useRef('');
  const submittingRef = useRef(false);
  const [reviewList, setReviewList] = useState<StickerRecord[]>([]);
  const [reviewError, setReviewError] = useState('');
  const [reviewBusy, setReviewBusy] = useState('');
  const reviewIds = useRef(new Map<string, string>());
  const reviewing = useRef(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const [toastVisible, setToastVisible] = useState(false);
  const [lastSticker, setLastSticker] = useState<StickerRecord | null>(null);

  useEffect(() => {
    setResponses(buildInitialResponses(template.items, fecha));
    setFinalColor('green');
    setOverrideReason('');
    setSupervisorApproval(false);
  }, [fecha, template]);

  const refreshReviews = useCallback(async () => {
    if (!canSupervisorApprove) return;
    setReviewError('');
    try {
      const { stickers } = await requestWorkshop<{ stickers: StickerRecord[] }>('stickers');
      setReviewList(stickers);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'No se pudieron consultar las inspecciones');
    }
  }, [canSupervisorApprove]);

  useEffect(() => { void refreshReviews(); }, [refreshReviews]);

  const inspectionInputs = useMemo(
    () =>
      template.items.map((item) => {
        const response = responses[item.id];
        return {
          itemId: item.id,
          status: response?.status ?? 'no_aplica',
          canOperate: response?.canOperate ?? true,
          dueDate: response?.dueDate,
        };
      }),
    [responses, template.items],
  );

  const decision = useMemo(
    () => evaluateStickerInspection(template.items, inspectionInputs),
    [inspectionInputs, template.items],
  );

  useEffect(() => {
    setFinalColor(decision.recommendedColor);
    setOverrideReason('');
  }, [decision.recommendedColor]);

  const answeredCount = template.items.filter((item) => responses[item.id]?.status !== null).length;
  const findingsCount = decision.findingItemIds.length;
  const evidenceGap = hasEvidenceGap(template.items, responses);
  const overrideNeedsReason = finalColor !== decision.recommendedColor && overrideReason.trim() === '';
  const canSubmit =
    !submitting && !lastSticker &&
    unitId.trim() !== '' && (!suggestedTemplate || templateId === suggestedTemplate) &&
    company.trim() !== '' &&
    answeredCount === template.items.length &&
    !evidenceGap &&
    !overrideNeedsReason;

  const groupedItems = useMemo(() => {
    const groups = new Map<string, StickerInspectionItem[]>();
    for (const item of template.items) {
      const existing = groups.get(item.section) ?? [];
      existing.push(item);
      groups.set(item.section, existing);
    }
    return [...groups.entries()];
  }, [template.items]);

  function updateResponse(itemId: string, patch: Partial<ItemResponse>) {
    setResponses((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      return { ...prev, [itemId]: { ...current, ...patch } };
    });
  }

  function updateStatus(item: StickerInspectionItem, status: StickerInspectionStatus) {
    updateResponse(item.id, {
      status,
      canOperate: status === 'no_cumple' ? false : item.hardStop ? status !== 'condicionado' : true,
    });
  }

  const handlePhotoCapture = useCallback((itemId: string, file: File) => {
    const preview = URL.createObjectURL(file);
    setResponses((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      return {
        ...prev,
        [itemId]: { ...current, photos: [...current.photos, { file, preview }] },
      };
    });
  }, []);

  const handlePhotoRemove = useCallback((itemId: string, photoIndex: number) => {
    setResponses((prev) => {
      const current = prev[itemId];
      if (!current) return prev;
      const photos = [...current.photos];
      const removed = photos.splice(photoIndex, 1);
      if (removed[0]) URL.revokeObjectURL(removed[0].preview);
      return { ...prev, [itemId]: { ...current, photos } };
    });
  }, []);

  function showToast(message: string, type: ToastType = 'success') {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  }

  async function handleSubmit() {
    if (!canSubmit || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    captureId.current ||= crypto.randomUUID();
    try {
      const result = await saveWorkshopCapture<StickerRecord>({
        endpoint: 'sticker',
        mutationId: captureId.current,
        input: {
          unit: unitId, templateId, company, date: fecha, time: hora, finalColor, overrideReason,
          approve: canApproveAtCapture && supervisorApproval,
          checks: template.items.map(({ id }) => {
            const answer = responses[id]!;
            return { itemId: id, status: answer.status, comment: answer.comment, canOperate: answer.canOperate, dueDate: answer.dueDate };
          }),
        },
        photos: template.items.flatMap(({ id }) => responses[id]!.photos.map(({ file }) => ({ file, itemId: id }))),
      });
      if (result.kind === 'pending') {
        setPending(result.reason);
        return;
      }
      setPending('');
      setLastSticker(result.result);
      showToast(result.result.approvalState === 'aprobado_supervisor'
        ? `Sticker ${colorLabel(result.result.color)} guardado. ${result.result.folio}`
        : `Inspección ${result.result.folio} guardada y pendiente de revisión`);
      void refreshReviews();
    } catch (error) {
      if (error instanceof WorkshopApiError && error.status === 400) {
        captureId.current = '';
        setPending('');
      }
      showToast(error instanceof Error ? error.message : 'No se pudo confirmar la inspección', 'error');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function approveSticker(folio: string) {
    if (reviewing.current) return;
    reviewing.current = true;
    setReviewBusy(folio);
    setReviewError('');
    const mutationId = reviewIds.current.get(folio) ?? crypto.randomUUID();
    reviewIds.current.set(folio, mutationId);
    try {
      const receipt = await requestWorkshop<StickerRecord>('stickerreview', { mutationId, folio });
      reviewIds.current.delete(folio);
      setLastSticker(receipt);
      setReviewList((items) => items.filter((item) => item.folio !== folio));
      showToast(`Revisión registrada. ${receipt.folio}`);
    } catch (error) {
      if (error instanceof WorkshopApiError && [400, 403, 404, 409].includes(error.status)) reviewIds.current.delete(folio);
      setReviewError(error instanceof Error ? error.message : 'No se pudo confirmar la revisión');
    } finally {
      reviewing.current = false;
      setReviewBusy('');
    }
  }

  return (
    <div className="flex flex-col pb-6 animate-fade-up">
      <SuccessToast message={toastMessage} visible={toastVisible} type={toastType} onDismiss={() => setToastVisible(false)} />

      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
          aria-label="Regresar"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-text">Sticker 15 dias</h1>
          <p className="text-xs text-text-secondary">Inspeccion formal con evidencia y aprobacion</p>
        </div>
      </div>

      {canSupervisorApprove && (
        <section className="mb-4 rounded-xl border border-border bg-white p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-text">Inspecciones por revisar</h2>
            <button type="button" onClick={() => void refreshReviews()} className="text-sm font-medium text-amber">Actualizar</button>
          </div>
          {reviewError && <p role="alert" className="text-sm text-critical">{reviewError}</p>}
          {reviewList.length === 0 && !reviewError && <p className="text-sm text-text-secondary">Sin inspecciones pendientes.</p>}
          {reviewList.map((item) => (
            <details key={item.folio} className="mb-2 rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-semibold text-text">{item.unitId} · {colorLabel(item.color)} · {item.folio}</summary>
              <p className="my-2 text-xs text-text-secondary">{item.inspectionDate} · {item.inspector}</p>
              {item.findings.map((finding) => (
                <div key={finding.itemId} className="mb-2 text-sm text-text">
                  <p>{finding.label} {finding.comment}</p>
                  {finding.dueDate && <p className="text-xs text-text-secondary">Compromiso {finding.dueDate}</p>}
                  <div className="flex flex-wrap gap-2">
                    {finding.photos.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-amber">Ver evidencia</a>)}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => void approveSticker(item.folio)}
                disabled={!!reviewBusy}
                className="mt-2 rounded-lg bg-amber px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {reviewBusy === item.folio ? 'Guardando…' : 'Aprobar revisión'}
              </button>
            </details>
          ))}
        </section>
      )}

      <fieldset disabled={submitting || !!pending || !!lastSticker} className="min-w-0">
      <div className="grid grid-cols-3 gap-2 mb-4">
        <StatusTile icon={<ClipboardCheck size={18} />} label="Respondidos" value={`${answeredCount}/${template.items.length}`} />
        <StatusTile icon={<FileText size={18} />} label="Hallazgos" value={String(findingsCount)} />
        <StatusTile icon={isOnline ? <ShieldCheck size={18} /> : <WifiOff size={18} />} label="Modo" value={isOnline ? 'Online' : 'Offline'} />
      </div>

      <section className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <input type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} className="field-input" />
          </Field>
          <Field label="Hora">
            <input type="time" value={hora} onChange={(event) => setHora(event.target.value)} className="field-input" />
          </Field>
        </div>

        <Field label="Empresa">
          <input value={company} onChange={(event) => setCompany(event.target.value)} className="field-input" />
        </Field>

        <Field label="Unidad / NFC / QR">
          <select value={unitId} onChange={(event) => {
            const nextUnit = equipment.find(item => item.unit_id === event.target.value);
            setUnitId(event.target.value);
            const nextTemplate = project === 'tmf-panama' && nextUnit && stickerTemplateForEquipment(nextUnit.type, nextUnit.model);
            if (nextTemplate) setTemplateId(nextTemplate);
            setResponses(buildInitialResponses(getStickerTemplate(nextTemplate || templateId).items, fecha));
          }} className="field-input bg-white">
            <option value="">Seleccionar unidad...</option>
            {equipment.map((eq) => (
              <option key={eq.unit_id} value={eq.unit_id}>
                {eq.unit_id} - {eq.model}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tipo de equipo">
          <select
            value={templateId}
            disabled={Boolean(suggestedTemplate)}
            onChange={(event) => setTemplateId(event.target.value as EquipmentInspectionClass)}
            className="field-input bg-white"
          >
            {STICKER_INSPECTION_TEMPLATES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section className="bg-white rounded-xl p-4 shadow-sm border border-border mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Resultado recomendado</p>
            <div className="flex items-center gap-2 mt-2">
              <span className={`w-4 h-4 rounded-full ${colorClass(decision.recommendedColor)}`} />
              <span className="text-lg font-bold text-text">{colorLabel(decision.recommendedColor)}</span>
            </div>
          </div>
          <BadgeCheck size={28} className="text-amber shrink-0" />
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {decision.badges.length > 0 ? (
            decision.badges.map((badge) => (
              <span key={badge} className="text-xs rounded-full bg-gray-100 text-text-secondary px-3 py-1">
                {badge}
              </span>
            ))
          ) : (
            <span className="text-xs rounded-full bg-green-50 text-success px-3 py-1">Sin restricciones</span>
          )}
        </div>

        <Field label="Color final">
          <select value={finalColor} onChange={(event) => setFinalColor(event.target.value as StickerColor)} className="field-input bg-white">
            {COLORS.slice(COLORS.indexOf(decision.recommendedColor)).map((color) => (
              <option key={color} value={color}>{colorLabel(color)}</option>
            ))}
          </select>
        </Field>

        {finalColor !== decision.recommendedColor && (
          <Field label="Justificación del cambio">
            <textarea
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              rows={2}
              className="field-input resize-none"
              placeholder="Explique por que cambia el color recomendado."
            />
          </Field>
        )}

        {canApproveAtCapture && (
          <label className="mt-3 flex items-center gap-3 rounded-xl border border-border p-3">
            <input
              type="checkbox"
              checked={supervisorApproval}
              onChange={(event) => setSupervisorApproval(event.target.checked)}
              className="w-5 h-5"
            />
            <span className="text-sm font-medium text-text">Aprobar inspección como supervisor</span>
          </label>
        )}
      </section>

      <div className="flex flex-col gap-4">
        {groupedItems.map(([section, items]) => (
          <section key={section} className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-text-secondary px-1">{section}</h2>
            {items.map((item) => {
              const response = responses[item.id];
              if (!response) return null;
              const needsEvidence = response.status === 'condicionado' || response.status === 'no_cumple';
              return (
                <div key={item.id} className="bg-white rounded-xl p-3 shadow-sm border border-border">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text leading-snug">{item.label}</p>
                      <p className="text-xs text-text-secondary mt-1">
                        {item.hardStop ? 'Debe cumplir / bloqueo si falla' : item.conditionalGuidance ?? 'Condicionado con fecha compromiso'}
                      </p>
                    </div>
                    {item.hardStop && (
                      <span className="shrink-0 text-[11px] font-bold rounded-full bg-red-50 text-critical px-2 py-1">
                        Critico
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-1 mt-3">
                    {STATUS_OPTIONS.filter((option) => !item.hardStop || option.value !== 'no_aplica').map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateStatus(item, option.value)}
                        className={`rounded-lg px-1 text-xs font-semibold border transition-colors ${
                          response.status === option.value
                            ? 'bg-amber text-white border-amber'
                            : 'bg-white text-text-secondary border-border'
                        }`}
                        style={{ minHeight: 42 }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {needsEvidence && (
                    <div className="mt-3 flex flex-col gap-3">
                      <PhotoCapture
                        photos={response.photos}
                        onCapture={(file) => handlePhotoCapture(item.id, file)}
                        onRemove={(index) => handlePhotoRemove(item.id, index)}
                        multiple
                      />

                      <textarea
                        value={response.comment}
                        onChange={(event) => updateResponse(item.id, { comment: event.target.value })}
                        rows={2}
                        className="field-input resize-none"
                        placeholder="Hallazgo, condicion operativa o causa de rechazo..."
                      />

                      {response.status === 'condicionado' && (
                        <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                          <Field label="Fecha compromiso">
                            <input
                              type="date"
                              value={response.dueDate}
                              onChange={(event) => updateResponse(item.id, { dueDate: event.target.value })}
                              className="field-input"
                            />
                          </Field>
                          <label className="flex items-center gap-2 rounded-xl border border-border px-3 h-[46px]">
                            <input
                              type="checkbox"
                              checked={response.canOperate}
                              onChange={(event) => updateResponse(item.id, { canOperate: event.target.checked })}
                            />
                            <span className="text-xs font-medium text-text">Opera</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>

      </fieldset>
      {pending && <p role="status" className="mt-3 rounded-lg bg-amber/10 p-3 text-sm text-text">Guardado pendiente. {pending}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-5 w-full bg-amber text-white rounded-xl py-4 font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
      >
        {submitting ? 'Guardando…' : pending ? 'Reintentar' : canApproveAtCapture && supervisorApproval ? 'Aprobar inspección' : 'Guardar para revisión'}
      </button>

      {lastSticker?.approvalState === 'aprobado_supervisor' && (
        <button
          type="button"
          onClick={() => printSticker(lastSticker)}
          className="mt-3 w-full bg-white text-text rounded-xl py-3 font-semibold border border-border shadow-sm flex items-center justify-center gap-2"
        >
          <CalendarDays size={18} />
          Imprimir / guardar sticker
        </button>
      )}

      {evidenceGap && answeredCount === template.items.length && (
        <p className="text-xs text-critical text-center mt-3">
          Los puntos condicionados o no conformes requieren foto, comentario y fecha compromiso cuando aplique.
        </p>
      )}
    </div>
  );
}

function StatusTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-border shadow-sm">
      <div className="text-amber mb-2">{icon}</div>
      <p className="text-lg font-bold text-text leading-none">{value}</p>
      <p className="text-[11px] text-text-secondary mt-1">{label}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 mt-2">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  );
}
