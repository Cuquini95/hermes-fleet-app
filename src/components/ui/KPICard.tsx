interface KPICardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
}

export default function KPICard({ icon, value, label, color }: KPICardProps) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-white"
          style={{ backgroundColor: color }}
        >
          {icon}
        </span>
        <p className="min-w-0 break-words text-xs font-medium text-text-secondary sm:text-sm">{label}</p>
      </div>
      <p className="mt-2 min-w-0 break-words text-xl leading-tight font-bold text-text tabular-nums sm:text-2xl">{value}</p>
    </div>
  );
}
