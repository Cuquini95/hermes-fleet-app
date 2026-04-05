interface KPICardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  color: string;
}

export default function KPICard({ icon, value, label, color }: KPICardProps) {
  return (
    <div className="bg-card rounded-xl shadow-sm p-4 border border-border flex items-center gap-3 flex-1">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        <span className="text-white flex items-center justify-center">{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-text leading-none">{value}</p>
        <p className="text-sm text-text-secondary mt-0.5">{label}</p>
      </div>
    </div>
  );
}
