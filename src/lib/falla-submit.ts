import { tryUploadPhoto } from './photo-upload-safe';

export interface FallaPhotoUploadSummary {
  urls: string[];
  failedCount: number;
}

type UploadPhoto = (file: File, bucket: string, path?: string) => Promise<string>;

export async function uploadFallaPhotos(
  files: File[],
  uploadPhoto: UploadPhoto = tryUploadPhoto,
): Promise<FallaPhotoUploadSummary> {
  const uploadBatchId = Date.now();
  const results = await Promise.all(
    files.map((file, index) => uploadPhoto(file, 'falla-photos', `${uploadBatchId}-${index}`)),
  );
  const urls = results.filter((url) => url.trim() !== '');

  return {
    urls,
    failedCount: files.length - urls.length,
  };
}

export function fallaSavedMessage(otId: string, failedPhotoCount: number): string {
  if (failedPhotoCount <= 0) return `${otId} creada - Jefe de Taller notificado`;
  return `${otId} creada. ${failedPhotoCount} foto(s) no subieron; la falla ya quedo registrada.`;
}
