import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, WifiOff, Languages, PackagePlus } from 'lucide-react';
import { searchParts, type PartResult } from '../../lib/hermes-api';
import { expandQuery } from '../../lib/parts-dictionary';
import PartCard from './PartCard';

const EQUIPMENT_FILTERS = ['Todos', 'Komatsu', 'CAT', 'Doosan', 'Mack'];

/** Merge results from multiple queries, deduplicating by part_number */
function mergeResults(arrays: PartResult[][]): PartResult[] {
  const seen = new Set<string>();
  const merged: PartResult[] = [];
  for (const arr of arrays) {
    for (const part of arr) {
      if (!seen.has(part.part_number)) {
        seen.add(part.part_number);
        merged.push(part);
      }
    }
  }
  return merged;
}

export default function PartsSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedEquipo, setSelectedEquipo] = useState('Todos');
  const [results, setResults] = useState<PartResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [bilingualHit, setBilingualHit] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setApiError(false);
      setBilingualHit(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setApiError(false);
      setBilingualHit(false);

      try {
        const equipo = selectedEquipo !== 'Todos' ? selectedEquipo : undefined;
        const terms = expandQuery(query);
        const isBilingual = terms.length > 1;

        // Fire all translated queries in parallel
        const allResults = await Promise.all(
          terms.map((term) => searchParts(term, equipo))
        );

        const merged = mergeResults(allResults);
        setResults(merged);

        // Show bilingual indicator only when translation actually added extra results
        if (isBilingual && merged.length > allResults[0].length) {
          setBilingualHit(true);
        }
      } catch {
        setResults([]);
        setApiError(true);
      } finally {
        setLoading(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selectedEquipo]);

  return (
    <div className="flex flex-col py-4">
      {/* Header row with import button */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-text">Partes</h1>
        <button
          onClick={() => navigate('/parts/import')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber text-white text-xs font-semibold"
        >
          <PackagePlus size={14} />
          Importar
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-3">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar en español o inglés — alternador / alternator…"
          className="w-full bg-white rounded-xl border-2 border-border focus:border-amber outline-none pl-11 pr-4 py-4 text-sm text-text placeholder:text-text-secondary"
        />
      </div>

      {/* Equipment filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {EQUIPMENT_FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedEquipo(filter)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              selectedEquipo === filter
                ? 'bg-amber text-white border-amber'
                : 'bg-white text-text-secondary border-border hover:border-amber'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Bilingual indicator */}
      {bilingualHit && !loading && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
          <Languages size={14} className="text-blue-500 flex-shrink-0" />
          <p className="text-xs text-blue-600">
            Se encontraron resultados adicionales buscando en inglés también.
          </p>
        </div>
      )}

      {/* States */}
      {loading && (
        <p className="text-center text-text-secondary text-sm py-4">Buscando…</p>
      )}

      {!loading && apiError && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <WifiOff size={28} className="text-text-secondary" />
          <p className="text-sm font-medium text-text">Sin conexión al servidor</p>
          <p className="text-xs text-text-secondary">Verifica que el VPS esté activo e intenta de nuevo.</p>
        </div>
      )}

      {!loading && !apiError && query && results.length === 0 && (
        <p className="text-center text-text-secondary text-sm py-4">
          No se encontraron resultados para "{query}"
        </p>
      )}

      {!loading && !query && (
        <p className="text-center text-text-secondary text-sm py-8">
          Ingresa un número de parte, descripción o nombre de equipo
        </p>
      )}

      {results.map((part) => (
        <PartCard key={part.part_number} part={part} />
      ))}
    </div>
  );
}
