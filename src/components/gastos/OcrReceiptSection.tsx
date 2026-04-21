/**
 * OcrReceiptSection — camera/gallery buttons that trigger OCR,
 * plus fallback manual photo capture when OCR is not available.
 */

import { useRef } from 'react';
import { Camera, Upload, CheckCircle, AlertCircle, Loader2, ScanLine } from 'lucide-react';
import PhotoCapture from '../ui/PhotoCapture';

interface PhotoItem {
  file: File;
  preview: string;
}

interface OcrReceiptSectionProps {
  ocrLoading: boolean;
  ocrDone: boolean;
  ocrError: string | null;
  imageUrl: string;
  receiptPhotos: PhotoItem[];
  onFileSelected: (file: File) => void;
  onManualCapture: (file: File) => void;
  onManualRemove: () => void;
}

/**
 * Renders OCR trigger buttons (camera + gallery) and status feedback.
 * Falls back to a plain photo capture when OCR has not run yet.
 */
export function OcrReceiptSection({
  ocrLoading,
  ocrDone,
  ocrError,
  imageUrl,
  receiptPhotos,
  onFileSelected,
  onManualCapture,
  onManualRemove,
}: OcrReceiptSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
  }

  return (
    <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
      <p className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
        <ScanLine size={16} /> Escanear Recibo / Factura
      </p>

      <div className="flex gap-3">
        {/* Camera */}
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex-1 flex flex-col items-center gap-1 border-2 border-dashed border-border rounded-lg py-4 text-text-secondary hover:border-amber transition-colors"
        >
          <Camera size={22} />
          <span className="text-xs">Cámara</span>
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileInput}
        />

        {/* Gallery */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex-1 flex flex-col items-center gap-1 border-2 border-dashed border-border rounded-lg py-4 text-text-secondary hover:border-amber transition-colors"
        >
          <Upload size={22} />
          <span className="text-xs">Galería / PDF</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* OCR feedback */}
      {ocrLoading && (
        <div className="flex items-center gap-2 mt-3 text-sm text-text-secondary">
          <Loader2 size={16} className="animate-spin" />
          Leyendo recibo…
        </div>
      )}
      {ocrDone && !ocrLoading && (
        <div className="flex items-center gap-2 mt-3 text-sm text-success">
          <CheckCircle size={16} />
          Datos extraídos — revisa y corrige si es necesario
        </div>
      )}
      {ocrError && (
        <div className="flex items-center gap-2 mt-3 text-sm text-red-600">
          <AlertCircle size={16} />
          {ocrError}
        </div>
      )}

      {/* Standalone photo (no OCR) */}
      {!imageUrl && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-xs text-text-secondary mb-2">
            {ocrDone ? 'Foto ya adjunta desde escáner' : 'Foto del recibo (sin OCR)'}
          </p>
          {!ocrDone && (
            <PhotoCapture
              photos={receiptPhotos}
              onCapture={onManualCapture}
              onRemove={onManualRemove}
              multiple={false}
            />
          )}
        </div>
      )}
      {imageUrl && (
        <div className="mt-3 border-t border-border pt-3 flex items-center gap-2 text-xs text-success">
          <CheckCircle size={14} />
          Foto subida correctamente
        </div>
      )}
    </div>
  );
}
