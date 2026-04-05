import { useState, useRef } from 'react';
import { Camera, Send, X } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string, photo?: File) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    e.target.value = '';
  }

  function handleRemovePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
  }

  function handleSend() {
    if (!text.trim() && !photo) return;
    onSend(text.trim(), photo ?? undefined);
    setText('');
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(null);
    setPhotoPreview(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const canSend = (text.trim().length > 0 || photo !== null) && !disabled;

  return (
    <div
      className="bg-white border-t px-4 py-3"
      style={{ borderColor: '#E5E7EB' }}
    >
      {photoPreview && (
        <div className="flex items-center gap-2 mb-2">
          <div className="relative">
            <img
              src={photoPreview}
              alt="Foto seleccionada"
              className="w-12 h-12 rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#DC2626' }}
            >
              <X size={10} color="white" />
            </button>
          </div>
          <span className="text-xs" style={{ color: '#6B7280' }}>
            {photo?.name ?? 'foto.jpg'}
          </span>
        </div>
      )}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40"
          style={{ backgroundColor: '#2563EB' }}
        >
          <Camera size={18} color="white" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Escribe tu consulta..."
          rows={1}
          className="flex-1 rounded-xl px-4 py-3 text-sm resize-none outline-none disabled:opacity-40"
          style={{
            backgroundColor: '#F9FAFB',
            color: '#1A2B2B',
            border: '1px solid #E5E7EB',
            maxHeight: 120,
            overflowY: 'auto',
          }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity disabled:opacity-40"
          style={{ backgroundColor: '#2563EB' }}
        >
          <Send size={18} color="white" />
        </button>
      </div>
    </div>
  );
}
