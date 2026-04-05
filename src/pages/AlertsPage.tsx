import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Package, Clock, CheckCircle, Wrench, TrendingUp } from 'lucide-react';

interface Alert {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  unread: boolean;
}

const MOCK_ALERTS: Alert[] = [
  {
    id: '1',
    title: 'D155-02 Fuera de Servicio',
    description: 'Unidad reportada fuera de servicio. Requiere atención inmediata del taller.',
    timestamp: 'Hace 15 min',
    type: 'critical',
    unread: true,
  },
  {
    id: '2',
    title: 'Stock Bajo: Pastillas de Freno',
    description: 'Inventario por debajo del mínimo. Stock actual: 2 juegos. Mínimo: 5.',
    timestamp: 'Hace 42 min',
    type: 'warning',
    unread: true,
  },
  {
    id: '3',
    title: 'PM Vencido: MACK-07',
    description: 'MACK-07 tiene mantenimiento preventivo vencido desde hace 85 hrs.',
    timestamp: 'Hace 2 hrs',
    type: 'warning',
    unread: false,
  },
  {
    id: '4',
    title: 'DVIR Completado: EPAK-09',
    description: 'Inspección pre-operación completada con resultado aprobado. Operador: Carlos M.',
    timestamp: 'Hace 4 hrs',
    type: 'info',
    unread: false,
  },
  {
    id: '5',
    title: 'OT Completada: OT-20260402-0800',
    description: 'Orden de trabajo completada. Cambio de aceite y filtros en EPAK-07.',
    timestamp: 'Ayer 16:30',
    type: 'success',
    unread: false,
  },
  {
    id: '6',
    title: 'Consumo Anómalo: EPAK-09',
    description: 'Consumo de combustible 38% sobre el benchmark. Revisar posibles fugas.',
    timestamp: 'Ayer 08:15',
    type: 'warning',
    unread: false,
  },
];

const BORDER_COLORS: Record<Alert['type'], string> = {
  critical: 'border-l-critical',
  warning: 'border-l-amber',
  info: 'border-l-blue-500',
  success: 'border-l-success',
};

const ICON_BG_COLORS: Record<Alert['type'], string> = {
  critical: 'bg-red-100',
  warning: 'bg-amber-100',
  info: 'bg-blue-100',
  success: 'bg-green-100',
};

const ICON_COLORS: Record<Alert['type'], string> = {
  critical: 'text-critical',
  warning: 'text-amber',
  info: 'text-blue-600',
  success: 'text-success',
};

function AlertIcon({ type, title }: { type: Alert['type']; title: string }) {
  const iconClass = `${ICON_COLORS[type]}`;
  const size = 18;

  if (type === 'critical') return <AlertCircle size={size} className={iconClass} />;
  if (title.toLowerCase().includes('stock') || title.toLowerCase().includes('inventario')) {
    return <Package size={size} className={iconClass} />;
  }
  if (title.toLowerCase().includes('pm') || title.toLowerCase().includes('mantenimiento')) {
    return <Clock size={size} className={iconClass} />;
  }
  if (title.toLowerCase().includes('ot') || title.toLowerCase().includes('completada')) {
    return <Wrench size={size} className={iconClass} />;
  }
  if (title.toLowerCase().includes('dvir')) {
    return <CheckCircle size={size} className={iconClass} />;
  }
  return <TrendingUp size={size} className={iconClass} />;
}

export default function AlertsPage() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState(MOCK_ALERTS);

  function markAsRead(id: string) {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, unread: false } : a))
    );
  }

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
        <h1 className="text-xl font-bold text-text">Alertas</h1>
        <div className="ml-auto bg-amber text-white text-xs font-bold px-2 py-1 rounded-full">
          {alerts.filter((a) => a.unread).length}
        </div>
      </div>

      {/* Alert feed */}
      <div className="flex flex-col gap-3">
        {alerts.map((alert) => (
          <button
            key={alert.id}
            type="button"
            onClick={() => markAsRead(alert.id)}
            className={`bg-white rounded-xl shadow-sm border border-border border-l-4 ${BORDER_COLORS[alert.type]} p-4 flex items-start gap-3 text-left w-full transition-opacity`}
          >
            {/* Icon */}
            <div className={`${ICON_BG_COLORS[alert.type]} rounded-full p-2 shrink-0 mt-0.5`}>
              <AlertIcon type={alert.type} title={alert.title} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-text text-sm leading-tight">{alert.title}</p>
              <p className="text-text-secondary text-xs mt-1 leading-relaxed">{alert.description}</p>
              <p className="text-text-secondary text-xs mt-2">{alert.timestamp}</p>
            </div>

            {/* Unread dot */}
            {alert.unread && (
              <div className="w-2.5 h-2.5 rounded-full bg-amber shrink-0 mt-1.5" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
