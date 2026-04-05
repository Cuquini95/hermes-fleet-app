import { useRef } from 'react';
import { Camera, X } from 'lucide-react';

interface PhotoItem {
  file: File;
  preview: string;
}

interface PhotoCaptureProps {
  onCapture: (file: File) => void;
  photos: PhotoItem[];
  onRemove: (index: number) => void;
  multiple?: boolean;
}

export default function PhotoCapture({ onCapture, photos, onRemove, multiple = false }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    onCapture(file);
    e.target.value = '';
  }

  const showButton = multiple || photos.length === 0;

  return (
    <div className="flex flex-col gap-2">
      {showButton && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 border border-amber text-amber rounded-xl px-4 py-2 font-medium text-sm w-fit"
        >
          <Camera size={18} />
          Agregar foto
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />
      {photos.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {photos.map((photo, index) => (
            <div key={index} className="relative w-20 h-20">
              <img
                src={photo.preview}
                alt={`Foto ${index + 1}`}
                className="w-20 h-20 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
