import { uploadPhoto } from './photo-upload';

export interface FallaPhotoUploadSummary {
  urls: string[];
}

type UploadPhoto = (file: File, bucket: string, path?: string) => Promise<string>;

export async function uploadFallaPhotos(
  files: File[],
  upload: UploadPhoto = uploadPhoto,
): Promise<FallaPhotoUploadSummary> {
  const uploadBatchId = Date.now();
  const urls = await Promise.all(
    files.map((file, index) => upload(file, 'falla-photos', `${uploadBatchId}-${index}`)),
  );

  if (urls.some((url) => url.trim() === '')) {
    throw new Error('No se pudieron subir todas las fotos. Revisa Supabase o la conexión e intenta de nuevo.');
  }

  return { urls };
}

export function fallaSavedMessage(otId: string): string {
  return `${otId} creada - Jefe de Taller notificado`;
}
