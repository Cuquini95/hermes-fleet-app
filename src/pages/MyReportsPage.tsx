import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Fuel, Clock, FileText } from 'lucide-react';

interface Report {
  id: string;
  title: string;
  unit: string;
  time: string;
  badge?: string;
  badgeType?: 'success' | 'info' | 'neutral';
  value?: string;
  icon: 'dvir' | 'fuel' | 'horometro' | 'report';
}

const MOCK_REPORTS: Report[] = [
  {
    id: '1',
    title: 'DVIR Pre-Operación',
    unit: 'EPAK-09',
    time: '06:15',
    badge: 'Aprobado',
    badgeType: 'success',
    icon: 'dvir',
  },
  {
    id: '2',
    title: 'Combustible',
    unit: 'EPAK-09',
    time: '07:30',
    value: '150 L',
    icon: 'fuel',
  },
  {
    id: '3',
    title: 'Horómetro Inicio',
    unit: 'EPAK-09',
    time: '06:00',
    value: '8,450 hrs',
    icon: 'horometro',
  },
];

const BADGE_STYLES: Record<string, string> = {
  success: 'bg-green-100 text-success',
  info: 'bg-blue-100 text-blue-600',
  neutral: 'bg-gray-100 text-text-secondary',
};

function ReportIcon({ icon }: { icon: Report['icon'] }) {
  const cls = 'text-amber';
  const size = 20;
  if (icon === 'dvir') return <ClipboardList size={size} className={cls} />;
  if (icon === 'fuel') return <Fuel size={size} className={cls} />;
  if (icon === 'horometro') return <Clock size={size} className={cls} />;
  return <FileText size={size} className={cls} />;
}

export default function MyReportsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Mis Reportes de Hoy</h1>
      </div>

      {MOCK_REPORTS.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <FileText size={48} className="text-border" />
          <p className="text-text-secondary font-medium">No hay reportes hoy</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {MOCK_REPORTS.map((report) => (
            <div
              key={report.id}
              className="bg-white rounded-xl p-4 shadow-sm border border-border flex items-center gap-3"
            >
              {/* Icon */}
              <div className="bg-amber/10 rounded-xl p-3 shrink-0">
                <ReportIcon icon={report.icon} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text text-sm">{report.title}</p>
                <p className="text-text-secondary text-xs mt-0.5">{report.unit}</p>
              </div>

              {/* Time + badge/value */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-text-secondary text-xs font-mono">{report.time}</span>
                {report.badge && (
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      BADGE_STYLES[report.badgeType ?? 'neutral']
                    }`}
                  >
                    {report.badge}
                  </span>
                )}
                {report.value && (
                  <span className="text-text-secondary text-xs">{report.value}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
