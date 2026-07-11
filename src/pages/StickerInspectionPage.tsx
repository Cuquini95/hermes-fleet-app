import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { STICKER_INSPECTION_TEMPLATES, getStickerTemplate } from '../data/sticker-inspection-templates';
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
  statusLabel,
} from '../lib/sticker-inspection';
import { printSticker } from '../lib/sticker-print';
import { mexicoDateCompact, mexicoDateInput, mexicoTimeCompact, mexicoTimeInput } from '../lib/date-utils';
import { appendRow, SHEET_TABS } from '../lib/sheets-api';
import { tryUploadPhotos } from '../lib/photo-upload-safe';
import { queueSubmission, flushQueue } from '../lib/offline-queue';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { useAuthStore } from '../stores/auth-store';
import PhotoCapture from '../components/ui/PhotoCapture';
import SuccessToast from '../components/ui/SuccessToast';

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
}

const COMPANY_DEFAULT = 'TCM';
const PHOTO_COLUMN_INDEX = 16;
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

function formatInputDate(inputDate: string): string {
  if (!inputDate) return '';
  const [year, month, day] = inputDate.split('-');
  return day && month && year ? `${day}/${month}/${year}` : inputDate;
}

function getFindingSummary(items: StickerInspectionItem[], responses: Record<string, ItemResponse>): string {
  const findings = items
    .map((item) => ({ item, response: responses[item.id] }))
    .filter(({ response }) => response?.status === 'condicionado' || response?.status === 'no_cumple');

  if (findings.length === 0) return 'Sin hallazgos abiertos.';

  return findings
    .slice(0, 4)
    .map(({ item, response }) => {
      if (!response) return `${item.section} - ${item.label}`;
      return `${statusLabel(response.status ?? 'no_aplica')}: ${item.section} - ${response.comment || item.label}`;
    })
    .join(' | ');
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

function buildFindingRecords(
  items: StickerInspectionItem[],
  responses: Record<string, ItemResponse>,
): StickerFindingRecord[] {
  return items
    .map((item) => ({ item, response: responses[item.id] }))
    .filter(({ response }) => response?.status === 'condicionado' || response?.status === 'no_cumple')
    .map(({ item, response }) => ({
      itemId: item.id,
      section: item.section,
      label: item.label,
      status: response?.status ?? 'no_aplica',
      comment: response?.comment ?? '',
      dueDate: response?.dueDate ?? '',
      canOperate: response?.canOperate ?? true,
      hardStop: item.hardStop === true,
    }));
}

export default function StickerInspectionPage() {
  const navigate = useNavigate();
  const equipment = useEquipmentList();
  const isOnline = useOnlineStatus();
  const userName = useAuthStore((s) => s.userName) || 'Inspector';
  const role = useAuthStore((s) => s.role);
  const canSupervisorApprove = role === 'supervisor' || role === 'gerencia';

  const [fecha, setFecha] = useState(mexicoDateInput());
  const [hora, setHora] = useState(mexicoTimeInput());
  const [company, setCompany] = useState(COMPANY_DEFAULT);
  const [unitId, setUnitId] = useState('');
  const [templateId, setTemplateId] = useState<EquipmentInspectionClass>('camion_articulado');
  const template = useMemo(() => getStickerTemplate(templateId), [templateId]);
  const [responses, setResponses] = useState<Record<string, ItemResponse>>(() => buildInitialResponses(template.items, fecha));
  const [finalColor, setFinalColor] = useState<StickerColor>('green');
  const [overrideReason, setOverrideReason] = useState('');
  const [supervisorApproval, setSupervisorApproval] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [lastSticker, setLastSticker] = useState<StickerRecord | null>(null);

  useEffect(() => {
    setResponses(buildInitialResponses(template.items, fecha));
    setFinalColor('green');
    setOverrideReason('');
    setSupervisorApproval(false);
  }, [fecha, template]);

  useEffect(() => {
    if (isOnline) flushQueue().catch(() => {});
  }, [isOnline]);

  const selectedEquipment = equipment.find((eq) => eq.unit_id === unitId);
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
    !submitting &&
    unitId.trim() !== '' &&
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

  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    const now = new Date();
    const folio = `${template.folioPrefix}-${mexicoDateCompact(now)}-${mexicoTimeCompact(now)}`;
    const expiryDate = addDaysToInputDate(fecha, 15);
    const approved = canSupervisorApprove && supervisorApproval;
    const approvalState = approved ? 'aprobado_supervisor' : 'pendiente_supervisor';
    const findingsSummary = getFindingSummary(template.items, responses);
    const allPhotoFiles = template.items.flatMap((item) => responses[item.id]?.photos.map((photo) => photo.file) ?? []);
    const findingRecords = buildFindingRecords(template.items, responses);

    const payload = {
      version: 1,
      source: 'hermes_sticker_inspection',
      sourceFiles: [template.sourceFile],
      rules: {
        colors: ['green', 'yellow', 'red'],
        noOrangeSticker: true,
        hardStopsBlockDispatch: true,
        submittedRecordsLocked: true,
      },
      decision: {
        recommendedColor: decision.recommendedColor,
        finalColor,
        overrideReason: overrideReason.trim(),
        canDispatch: finalColor !== 'red',
        badges: decision.badges,
      },
      findings: findingRecords,
    };

    let photoUrls: string[] = [];
    if (isOnline) {
      photoUrls = await tryUploadPhotos(allPhotoFiles, 'sticker-inspection-photos');
    }

    const row = [
      '',
      folio,
      `${fecha} ${hora}`,
      formatInputDate(fecha),
      hora.length === 5 ? `${hora}:00` : hora,
      unitId,
      selectedEquipment?.model ?? '',
      template.label,
      userName,
      approved ? userName : '',
      approvalState,
      decision.recommendedColor,
      finalColor,
      finalColor === 'red' ? 'no' : 'yes',
      formatInputDate(expiryDate),
      findingsSummary,
      photoUrls.join(', '),
      JSON.stringify(payload),
    ];

    const findingRows = findingRecords.map((finding) => [
      '',
      folio,
      `${fecha} ${hora}`,
      unitId,
      selectedEquipment?.model ?? '',
      template.label,
      finding.section,
      finding.itemId,
      finding.label,
      finding.status,
      finding.comment,
      finding.dueDate,
      finding.canOperate ? 'yes' : 'no',
      finding.hardStop ? 'critical' : finalColor === 'red' ? 'high' : 'medium',
      approvalState,
      formatInputDate(expiryDate),
    ]);

    try {
      if (isOnline) {
        appendRow(SHEET_TABS.INSPECCION_STICKERS, row).catch((err: unknown) => {
          console.error('Background write failed (sticker inspection):', err);
          queueSubmission({
            type: 'sticker_inspection',
            data: {
              tab: SHEET_TABS.INSPECCION_STICKERS,
              values: row,
              photoFiles: allPhotoFiles,
              photoBucket: 'sticker-inspection-photos',
              photoColumnIndex: PHOTO_COLUMN_INDEX,
            },
            timestamp: new Date().toISOString(),
          }).catch(() => {});
        });
        for (const findingRow of findingRows) {
          appendRow(SHEET_TABS.INSPECCION_HALLAZGOS, findingRow).catch((err: unknown) => {
            console.error('Background write failed (sticker finding):', err);
            queueSubmission({
              type: 'sticker_inspection',
              data: {
                tab: SHEET_TABS.INSPECCION_HALLAZGOS,
                values: findingRow,
              },
              timestamp: new Date().toISOString(),
            }).catch(() => {});
          });
        }
      } else {
        await queueSubmission({
          type: 'sticker_inspection',
          data: {
            tab: SHEET_TABS.INSPECCION_STICKERS,
            values: row,
            photoFiles: allPhotoFiles,
            photoBucket: 'sticker-inspection-photos',
            photoColumnIndex: PHOTO_COLUMN_INDEX,
          },
          timestamp: new Date().toISOString(),
        });
        for (const findingRow of findingRows) {
          await queueSubmission({
            type: 'sticker_inspection',
            data: {
              tab: SHEET_TABS.INSPECCION_HALLAZGOS,
              values: findingRow,
            },
            timestamp: new Date().toISOString(),
          });
        }
      }

      const stickerRecord = {
        folio,
        color: finalColor,
        unitId,
        company,
        inspectionDate: formatInputDate(fecha),
        expiryDate: formatInputDate(expiryDate),
        inspector: userName,
        supervisor: approved ? userName : '',
        qrText: `hermes://inspection/${folio}`,
        findingsSummary,
      };

      setLastSticker(stickerRecord);
      setToastMessage(
        approved
          ? `Sticker ${colorLabel(finalColor)} listo: ${folio}`
          : `Inspeccion ${folio} enviada a supervisor`,
      );
      setToastVisible(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col pb-6 animate-fade-up">
      <SuccessToast message={toastMessage} visible={toastVisible} onDismiss={() => setToastVisible(false)} />

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
          <select value={unitId} onChange={(event) => setUnitId(event.target.value)} className="field-input bg-white">
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
            <option value="green">Verde - Aprobado</option>
            <option value="yellow">Amarillo - Condicionado</option>
            <option value="red">Rojo - Rechazado</option>
          </select>
        </Field>

        {finalColor !== decision.recommendedColor && (
          <Field label="Justificacion del override">
            <textarea
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
              rows={2}
              className="field-input resize-none"
              placeholder="Explique por que cambia el color recomendado."
            />
          </Field>
        )}

        {canSupervisorApprove && (
          <label className="mt-3 flex items-center gap-3 rounded-xl border border-border p-3">
            <input
              type="checkbox"
              checked={supervisorApproval}
              onChange={(event) => setSupervisorApproval(event.target.checked)}
              className="w-5 h-5"
            />
            <span className="text-sm font-medium text-text">Aprobar como supervisor y habilitar sticker</span>
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
                    {STATUS_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateStatus(item, option.value)}
                        className={`rounded-lg px-2 text-xs font-semibold border transition-colors ${
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

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-5 w-full bg-amber text-white rounded-xl py-4 font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed transition-opacity btn-press"
      >
        {submitting ? 'Guardando...' : canSupervisorApprove && supervisorApproval ? 'Aprobar y generar sticker' : 'Enviar a aprobacion'}
      </button>

      {lastSticker && (
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
