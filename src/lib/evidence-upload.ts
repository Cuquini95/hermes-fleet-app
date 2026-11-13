import { EVIDENCE_ENDPOINT, isPrivateEvidenceUrl } from './evidence-link';
import { compressImage, fileToBase64 } from './photo-upload';
import { WorkshopApiError } from './workshop-api';

const MAX_BYTES = 3 * 1024 * 1024;

export interface EvidenceUpload {
  kind: 'report' | 'dvir' | 'sticker' | 'order' | 'receipt';
  units: string[];
  operationId: string;
  expectedUserId: string;
  slot: number;
  recordId?: string;
}

export async function uploadEvidence(file: File, scope: EvidenceUpload): Promise<string> {
  const pdf = file.type === 'application/pdf' && scope.kind === 'receipt';
  if (!file.size || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) && !pdf) {
    throw new WorkshopApiError('Adjunta una imagen JPG, PNG o WebP. Los recibos también admiten PDF.', 415);
  }
  let attachment: Blob = file;
  if (!pdf && file.size > MAX_BYTES) {
    try { attachment = await compressImage(file); }
    catch { throw new WorkshopApiError('No se pudo preparar la imagen. Selecciona otra foto.', 415); }
  }
  if (attachment.size > MAX_BYTES) throw new WorkshopApiError('El archivo supera 3 MB.', 413);
  const response = await fetch(EVIDENCE_ENDPOINT, {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(25_000),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...scope, mimeType: attachment.type, data: await fileToBase64(attachment) }),
  });
  const data: { url?: string; error?: string } | null = await response.json().catch(() => null);
  if (!response.ok || !isPrivateEvidenceUrl(data?.url)) {
    throw new WorkshopApiError(data?.error || 'No se pudo confirmar el archivo adjunto. Intenta de nuevo.', response.status);
  }
  return data.url;
}
