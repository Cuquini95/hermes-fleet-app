import { useRef } from 'react';
import { Camera, Upload, X } from 'lucide-react';

interface PhotoItem {
  file: File;
  preview: string;
}

interface PhotoCaptureProps {
  onCapture: (file: File) => void;
  photos: PhotoItem[];
  onRemove: (index: number) => void;
  multiple?: boolean;
  accept?: string;
  labels?: { camera: string; gallery: string };
}

export default function PhotoCapture({ onCapture, photos, onRemove, multiple = false, accept = 'image/*', labels }: PhotoCaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file) onCapture(file);
    }
    e.target.value = '';
  }

  const showButtons = multiple || photos.length === 0;

  return (
    <div className="flex flex-col gap-2">
      {showButtons && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex items-center gap-2 border border-amber text-amber rounded-xl px-4 font-medium text-sm w-fit"
            style={{ minHeight: 44 }}
          >
            <Camera size={18} aria-hidden />
            {labels?.camera ?? 'Agregar foto'}
          </button>
          <button
            type="button"
            onClick={() => uploadRef.current?.click()}
            className="flex items-center gap-2 border border-amber text-amber rounded-xl px-4 font-medium text-sm w-fit"
            style={{ minHeight: 44 }}
          >
            <Upload size={18} aria-hidden />
            {labels?.gallery ?? 'Subir archivo'}
          </button>
        </div>
      )}
      <input
        ref={cameraRef}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={uploadRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleFileChange}
      />
      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {photos.map((photo, index) => (
            <div key={photo.preview} className="relative w-20 h-20">
              <img
                src={photo.preview}
                alt={`Foto ${index + 1}`}
                className="w-20 h-20 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute top-0 right-0 bg-red-600 text-white rounded-full w-11 h-11 flex items-center justify-center"
                aria-label="Eliminar foto"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
