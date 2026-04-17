import { supabase, isSupabaseConfigured } from './supabase';

export { isSupabaseConfigured };

/** Compress an image File into a JPEG Blob, scaling down to maxWidth while preserving aspect ratio. */
export async function compressImage(file: File, maxWidth = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('Canvas not supported')); return; }
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => { if (blob) resolve(blob); else reject(new Error('Compression failed')); },
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload a photo (image/JPEG/PNG) or PDF to a Supabase Storage bucket and return its public URL.
 * Images are compressed first; PDFs are uploaded as-is. Throws if Supabase is not configured.
 */
export async function uploadPhoto(file: File, bucket: string, path?: string): Promise<string> {
  if (!supabase) throw new Error('Supabase is not configured');
  const isPdf = file.type === 'application/pdf';

  if (isPdf) {
    // Upload PDF as-is — no canvas compression
    const fileName = path ? `${path}.pdf` : `${crypto.randomUUID()}.pdf`;
    const { data, error } = await supabase.storage.from(bucket).upload(fileName, file, {
      contentType: 'application/pdf',
    });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  }

  const compressed = await compressImage(file);
  const fileName = path ? `${path}.jpg` : `${crypto.randomUUID()}.jpg`;
  const { data, error } = await supabase.storage.from(bucket).upload(fileName, compressed, {
    contentType: 'image/jpeg',
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

/** Read a File and resolve to its base64-encoded payload (without the data: prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const payload = result.split(',')[1];
      if (payload === undefined) {
        reject(new Error('Invalid data URL'));
        return;
      }
      resolve(payload);
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}
