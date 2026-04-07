import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export default function MyReportsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col pb-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Mis Reportes de Hoy</h1>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <FileText size={28} className="text-text-secondary" />
        </div>
        <p className="text-base font-semibold text-text">Sin reportes hoy</p>
        <p className="text-sm text-text-secondary text-center max-w-xs">
          Los reportes de Checklist, combustible y horómetro que envíes hoy aparecerán aquí.
        </p>
      </div>
    </div>
  );
}
