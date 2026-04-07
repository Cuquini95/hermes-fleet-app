interface StatusDotProps {
  status: string;
}

const STATUS_CLASSES: Record<string, string> = {
  operativo: 'bg-success',
  alerta: 'bg-warning animate-pulse-dot',
  taller: 'bg-critical',
  inactivo: 'bg-gray-400',
};

export default function StatusDot({ status }: StatusDotProps) {
  const cls = STATUS_CLASSES[status] ?? 'bg-gray-400';
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${cls}`}
    />
  );
}
