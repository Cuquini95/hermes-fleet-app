import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { ROLE_LABELS } from '../types/roles';

interface ScoreCategory {
  label: string;
  score: number;
  max: number;
}

interface Certification {
  name: string;
  expiry: string;
  status: 'vigente' | 'vencido';
}

const SCORE_CATEGORIES: ScoreCategory[] = [
  { label: 'Inspecciones', score: 18, max: 20 },
  { label: 'Condición Equipo', score: 22, max: 25 },
  { label: 'Combustible', score: 13, max: 15 },
  { label: 'Horas', score: 19, max: 20 },
  { label: 'Seguridad', score: 6, max: 20 },
];

const CERTIFICATIONS: Certification[] = [
  { name: 'DC-3 STPS', expiry: '15 Sep 2026', status: 'vigente' },
  { name: 'Operación Equipo Pesado', expiry: '3 Mar 2027', status: 'vigente' },
];

const totalScore = SCORE_CATEGORIES.reduce((sum, c) => sum + c.score, 0);
const totalMax = SCORE_CATEGORIES.reduce((sum, c) => sum + c.max, 0);

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.round((score / max) * 100);
  const color = pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-amber' : 'bg-critical';

  return (
    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function PerfilPage() {
  const navigate = useNavigate();

  const userName = useAuthStore((s) => s.userName);
  const role = useAuthStore((s) => s.role);
  const assignedUnits = useAuthStore((s) => s.assignedUnits);

  const roleLabel = role ? ROLE_LABELS[role] : 'Sin rol';
  const initials = userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const unitLabel = assignedUnits.length > 0 ? assignedUnits[0] : '';

  const overallPct = Math.round((totalScore / totalMax) * 100);
  const arcColor = overallPct >= 80 ? '#16A34A' : overallPct >= 50 ? '#2563EB' : '#DC2626';

  return (
    <div className="flex flex-col pb-4 gap-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl bg-white border border-border shadow-sm"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-bold text-text">Mi Perfil</h1>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-border flex flex-col items-center gap-3">
        {/* Avatar */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md"
          style={{ backgroundColor: '#2563EB' }}
        >
          {initials}
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text">{userName}</h2>
          <p className="text-text-secondary mt-0.5">{roleLabel}</p>
          {unitLabel && (
            <p className="text-sm text-amber font-medium mt-1">{unitLabel}</p>
          )}
        </div>
      </div>

      {/* Score card */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border">
        <h3 className="font-semibold text-text mb-4">Desempeño</h3>

        {/* Total score with arc */}
        <div className="flex items-center gap-4 mb-4">
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#E5E7EB" strokeWidth="8" />
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke={arcColor}
                strokeWidth="8"
                strokeDasharray={`${overallPct * 2.01} 201`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-bold text-text" style={{ transform: 'rotate(90deg) translateX(2px)' }}>
                {overallPct}%
              </span>
            </div>
          </div>
          <div>
            <p className="text-3xl font-bold text-text">{totalScore}/{totalMax}</p>
            <p className="text-text-secondary text-sm">Puntuación total</p>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="flex flex-col gap-3">
          {SCORE_CATEGORIES.map((cat) => (
            <div key={cat.label} className="flex items-center gap-3">
              <span className="text-sm text-text w-36 shrink-0">{cat.label}</span>
              <ScoreBar score={cat.score} max={cat.max} />
              <span className="text-sm font-semibold text-text w-12 text-right shrink-0">
                {cat.score}/{cat.max}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Ranking */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border flex items-center gap-3">
        <div className="bg-amber/10 rounded-full p-3">
          <Trophy size={24} className="text-amber" />
        </div>
        <div>
          <p className="font-semibold text-text">Posición en ranking</p>
          <p className="text-text-secondary text-sm">3° de 15 operadores</p>
        </div>
        <div className="ml-auto text-3xl font-bold text-amber">#3</div>
      </div>

      {/* Certifications */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-border">
        <h3 className="font-semibold text-text mb-3">Certificaciones</h3>
        <div className="flex flex-col gap-3">
          {CERTIFICATIONS.map((cert) => (
            <div
              key={cert.name}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
            >
              <div>
                <p className="font-medium text-text text-sm">{cert.name}</p>
                <p className="text-text-secondary text-xs mt-0.5">Vence: {cert.expiry}</p>
              </div>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  cert.status === 'vigente'
                    ? 'bg-green-100 text-success'
                    : 'bg-red-100 text-critical'
                }`}
              >
                {cert.status === 'vigente' ? 'Vigente' : 'Vencido'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
