interface StatusDotProps {
  status: 'operativo' | 'alerta' | 'taller' | 'inactivo';
}

const STATUS_CLASSES: Record<StatusDotProps['status'], string> = {
  operativo: 'bg-success',
  alerta: 'bg-warning animate-pulse-dot',
  taller: 'bg-critical',
  inactivo: 'bg-gray-400',
};

export default function StatusDot({ status }: StatusDotProps) {
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${STATUS_CLASSES[status]}`}
    />
  );
}
