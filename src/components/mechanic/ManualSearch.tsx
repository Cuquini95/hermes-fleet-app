import { useState } from 'react';
import { Search, FileText, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { manualLookup, type ManualLookupResult } from '../../lib/hermes-api';

const EQUIPMENT_OPTIONS = [
  'Seleccionar equipo',
  'Komatsu D155AX-6',
  'Komatsu D65EX-16',
  'Komatsu HM400-3',
  'CAT 740B',
  'Doosan DL420A',
  'Doosan DX340LC',
  'Doosan DX225LC',
  'Mack GR84B 8x4',
];

export default function ManualSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedEquipo, setSelectedEquipo] = useState('Seleccionar equipo');
  const [result, setResult] = useState<ManualLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(false);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setApiError(false);
    setResult(null);
    try {
      const equipo = selectedEquipo !== 'Seleccionar equipo' ? selectedEquipo : 'General';
      const data = await manualLookup({ equipo, tema: query });
      setResult(data);
    } catch {
      setApiError(true);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSearch();
  }

  return (
    <div className="flex flex-col py-4">
      {/* Search bar */}
      <div className="relative mb-3">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar por equipo, sistema o procedimiento..."
          className="w-full bg-white rounded-xl border-2 border-border focus:border-amber outline-none pl-11 pr-4 py-4 text-sm text-text placeholder:text-text-secondary"
        />
      </div>

      {/* Equipment selector */}
      <select
        value={selectedEquipo}
        onChange={(e) => setSelectedEquipo(e.target.value)}
        className="w-full bg-white rounded-xl border-2 border-border focus:border-amber outline-none px-4 py-3 text-sm text-text mb-4 appearance-none"
      >
        {EQUIPMENT_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>

      <button
        onClick={handleSearch}
        disabled={!query.trim() || loading}
        className="bg-amber text-white rounded-xl py-3 font-medium text-sm mb-6 disabled:opacity-50 transition-opacity"
      >
        {loading ? 'Buscando…' : 'Buscar Procedimiento'}
      </button>

      {/* Error state */}
      {apiError && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <WifiOff size={28} className="text-text-secondary" />
          <p className="text-sm font-medium text-text">Sin conexión al servidor</p>
          <p className="text-xs text-text-secondary">Verifica que el VPS esté activo e intenta de nuevo.</p>
        </div>
      )}

      {/* Result card */}
      {result && (
        <div className="bg-card rounded-xl shadow-sm border border-border p-4">
          <h3 className="font-semibold text-text text-base mb-3">Procedimiento</h3>

          <p className="text-sm text-text-secondary mb-4 leading-relaxed">{result.extracto}</p>

          <h4 className="font-semibold text-text text-sm mb-2">Pasos técnicos</h4>
          <ol className="list-decimal list-inside space-y-1.5 mb-4">
            {result.pasos_tecnicos.map((paso, i) => (
              <li key={i} className="text-sm text-text leading-relaxed">{paso}</li>
            ))}
          </ol>

          <h4 className="font-semibold text-text text-sm mb-2">Herramientas requeridas</h4>
          <ul className="list-disc list-inside space-y-1 mb-4">
            {result.herramientas_requeridas.map((tool, i) => (
              <li key={i} className="text-sm text-text-secondary">{tool}</li>
            ))}
          </ul>

          {result.torque_specs && (
            <>
              <h4 className="font-semibold text-text text-sm mb-2">Torques</h4>
              <p className="text-sm text-text-secondary mb-4">{result.torque_specs}</p>
            </>
          )}

          <button
            onClick={() => navigate('/diagrams')}
            className="w-full border-2 border-amber text-amber rounded-xl py-3 font-medium text-sm flex items-center justify-center gap-2 hover:bg-amber hover:text-white transition-colors"
          >
            <FileText size={16} />
            Ver PDF completo
          </button>
        </div>
      )}

      {!result && !loading && !apiError && (
        <p className="text-center text-text-secondary text-sm py-8">
          Ingresa un tema y selecciona el equipo para buscar procedimientos técnicos
        </p>
      )}
    </div>
  );
}
