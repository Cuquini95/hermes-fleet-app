import { supabase } from './supabase';

export async function compressImage(file: File, maxWidth = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('Canvas not supported')); return; }
    const img = new Image();
    img.onload = () => {
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

export async function uploadPhoto(file: File, bucket: string): Promise<string> {
  const compressed = await compressImage(file);
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  const { data, error } = await supabase.storage.from(bucket).upload(fileName, compressed, {
    contentType: 'image/jpeg',
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}
