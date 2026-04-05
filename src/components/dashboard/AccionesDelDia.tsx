import { FileText, Clock, AlertTriangle, Package, Shield } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';

interface Accion {
  icon: ComponentType<LucideProps>;
  text: string;
  color: string;
}

const acciones: Accion[] = [
  { icon: FileText, text: 'Briefing enviado a CEO y Gerencia', color: '#16A34A' },
  { icon: Clock, text: 'PM programado para EPAK-05 y EPAK-08', color: '#F59E0B' },
  { icon: AlertTriangle, text: 'OT crítica abierta para EPAK-09', color: '#DC2626' },
  { icon: Package, text: 'Reorden sugerido: filtros D155', color: '#2563EB' },
  { icon: Shield, text: 'Certificación STPS vence en 26 días', color: '#F59E0B' },
  { icon: FileText, text: 'Reporte semanal disponible en PDF', color: '#3B82F6' },
];

export default function AccionesDelDia() {
  return (
    <div className="bg-card rounded-xl shadow-sm p-4 border border-border">
      <h3 className="font-semibold text-text mb-3">Acciones del Día</h3>
      <div className="flex flex-col gap-2.5">
        {acciones.map((accion, i) => {
          const Icon = accion.icon;
          return (
            <div key={i} className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: accion.color + '1A' }}
              >
                <Icon size={16} style={{ color: accion.color }} />
              </div>
              <p className="text-sm text-text">{accion.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
