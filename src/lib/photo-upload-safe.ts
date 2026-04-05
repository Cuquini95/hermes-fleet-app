import { uploadPhoto, isSupabaseConfigured } from './photo-upload';

export { isSupabaseConfigured };

export async function tryUploadPhoto(file: File, bucket: string, path?: string): Promise<string> {
  if (!isSupabaseConfigured()) {
    return URL.createObjectURL(file);
  }
  try {
    return await uploadPhoto(file, bucket, path);
  } catch {
    return URL.createObjectURL(file);
  }
}

export async function tryUploadPhotos(files: File[], bucket: string): Promise<string[]> {
  return Promise.all(files.map((f, i) => tryUploadPhoto(f, bucket, `${Date.now()}-${i}`)));
}
