import { uploadPhoto, isSupabaseConfigured } from './photo-upload';

export { isSupabaseConfigured };

/**
 * Tries to upload a photo to Supabase Storage.
 * Returns the public URL if Supabase is configured and upload succeeds.
 * Returns empty string if Supabase is not configured or upload fails.
 * (Blob URLs are session-only and must NOT be written to Google Sheets.)
 */
export async function tryUploadPhoto(file: File, bucket: string, path?: string): Promise<string> {
  if (!isSupabaseConfigured()) {
    return '';
  }
  try {
    return await uploadPhoto(file, bucket, path);
  } catch {
    return '';
  }
}

export async function tryUploadPhotos(files: File[], bucket: string): Promise<string[]> {
  const results = await Promise.all(
    files.map((f, i) => tryUploadPhoto(f, bucket, `${Date.now()}-${i}`))
  );
  // Filter out empty strings (failed/unconfigured uploads)
  return results.filter((url) => url !== '');
}
