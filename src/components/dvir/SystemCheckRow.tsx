import {
  Cog,
  Settings,
  CircleStop,
  Navigation,
  Droplets,
  Zap,
  Circle,
  Box,
  Lightbulb,
  FlaskConical,
  LayoutDashboard,
  Footprints,
  type LucideProps,
} from 'lucide-react';
import type { DVIRSystem, CheckStatus } from '../../types/dvir';
import PhotoCapture from '../ui/PhotoCapture';

type IconComponent = React.ComponentType<LucideProps>;

const ICON_MAP: Record<string, IconComponent> = {
  Cog,
  Settings,
  CircleStop,
  Navigation,
  Droplets,
  Zap,
  Circle,
  Box,
  Lightbulb,
  Beaker: FlaskConical,
  LayoutDashboard,
  Footprints,
};

interface PhotoItem {
  file: File;
  preview: string;
}

interface SystemCheckRowProps {
  system: DVIRSystem;
  value: CheckStatus;
  onChange: (status: CheckStatus) => void;
  photos: PhotoItem[];
  onPhotoCapture: (file: File) => void;
  onPhotoRemove: (index: number) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export default function SystemCheckRow({
  system,
  value,
  onChange,
  photos,
  onPhotoCapture,
  onPhotoRemove,
  notes,
  onNotesChange,
}: SystemCheckRowProps) {
  const IconComponent = ICON_MAP[system.icon] ?? Cog;

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm border border-border mb-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <IconComponent size={18} className="text-text-secondary shrink-0" />
          <span className="font-medium text-text text-sm truncate">{system.label}</span>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onChange('ok')}
            className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
              value === 'ok'
                ? 'bg-success text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => onChange('alerta')}
            className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
              value === 'alerta'
                ? 'bg-warning text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            Alerta
          </button>
          <button
            type="button"
            onClick={() => onChange('falla')}
            className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
              value === 'falla'
                ? 'bg-critical text-white'
                : 'bg-gray-100 text-text-secondary'
            }`}
          >
            Falla
          </button>
        </div>
      </div>

      {value === 'falla' && (
        <div className="mt-3 flex flex-col gap-2">
          <PhotoCapture
            photos={photos}
            onCapture={onPhotoCapture}
            onRemove={onPhotoRemove}
            multiple={false}
          />
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Describe el problema..."
            rows={2}
            className="w-full rounded-xl border border-border p-2 text-sm text-text resize-none bg-white"
          />
        </div>
      )}
    </div>
  );
}
