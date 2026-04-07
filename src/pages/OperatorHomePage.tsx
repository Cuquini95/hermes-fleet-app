import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Camera,
  Fuel,
  Gauge,
  MapPin,
  FileText,
  CheckCircle,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { mexicoDate } from '../lib/date-utils';

interface ActionCard {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'Checklist', icon: <ClipboardCheck size={32} className="text-amber" />, path: '/dvir' },
  { label: 'Reportar Falla', icon: <Camera size={32} className="text-amber" />, path: '/falla' },
  { label: 'Diesel', icon: <Fuel size={32} className="text-amber" />, path: '/diesel' },
  { label: 'Horómetro', icon: <Gauge size={32} className="text-amber" />, path: '/horometro' },
  { label: 'Fletes', icon: <MapPin size={32} className="text-amber" />, path: '/flete' },
  { label: 'Mis Reportes', icon: <FileText size={32} className="text-amber" />, path: '/my-reports' },
];

export default function OperatorHomePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  const [dvirDone, setDvirDone] = useState<boolean | null>(null); // null = loading
  const [reportCount, setReportCount] = useState(0);

  const checkDVIRStatus = useCallback(async () => {
    try {
      const rows = await readRange(SHEET_TABS.INSPECCIONES);
      const today = mexicoDate();
      let todayCount = 0;
      let foundDVIR = false;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowDate = (row[2] ?? '').trim();  // FECHA column (index 2)
        const rowOperator = (row[6] ?? '').trim(); // OPERADOR column (index 6)

        if (rowDate === today && rowOperator === userName) {
          foundDVIR = true;
          todayCount++;
        }
      }

      setDvirDone(foundDVIR);
      setReportCount(todayCount);
    } catch {
      // If fetch fails, hide the banner rather than show false alarm
      setDvirDone(null);
    }
  }, [userName]);

  useEffect(() => {
    checkDVIRStatus();
  }, [checkDVIRStatus]);

  const greeting = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 18 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Greeting */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-text">{greeting}, {userName}</h1>
        <p className="text-text-secondary text-sm mt-0.5">Operador</p>
      </div>

      {/* DVIR status — dynamic from Google Sheets */}
      {dvirDone === false && (
        <div className="bg-red-50 border-l-4 border-critical rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-critical">
            ⚠️ Tu Checklist de hoy no ha sido completado
          </p>
        </div>
      )}
      {dvirDone === true && (
        <div className="bg-green-50 border-l-4 border-success rounded-lg p-3 mb-4 flex items-center gap-2">
          <CheckCircle size={16} className="text-success shrink-0" />
          <p className="text-sm font-medium text-success">
            Checklist completado hoy ✓
          </p>
        </div>
      )}

      {/* Action grid 2x3 */}
      <div className="grid grid-cols-2 gap-3">
        {ACTION_CARDS.map(({ label, icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center justify-center gap-2 bg-white rounded-xl p-4 shadow-sm border border-border btn-press"
            style={{ minHeight: 100 }}
          >
            {icon}
            <span className="text-sm font-medium text-center text-text">{label}</span>
          </button>
        ))}
      </div>

      {/* Footer counter — dynamic */}
      {reportCount > 0 && (
        <p className="text-sm text-success text-center mt-4 font-medium">
          Reportes hoy: {reportCount} ✓
        </p>
      )}
    </div>
  );
}
