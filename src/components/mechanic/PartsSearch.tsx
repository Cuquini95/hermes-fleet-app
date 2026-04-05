import { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { searchParts, type PartResult } from '../../lib/hermes-api';
import PartCard from './PartCard';

const EQUIPMENT_FILTERS = ['Todos', 'Komatsu', 'CAT', 'Doosan', 'Mack'];

const MOCK_PARTS: PartResult[] = [
  {
    part_number: 'KOM-07100-6171',
    description: 'Sello hidráulico 85mm — cilindro de dirección',
    oem_ref: '07100-61711',
    compatible_units: ['EPAK-09', 'EPAK-02'],
    stock_quantity: 4,
    stock_minimum: 2,
    location: 'Estante A-3',
    unit_price: 128.5,
    alternatives: ['SH-850-K', 'KOM-07100-6170'],
  },
  {
    part_number: 'KOM-21T-60-72231',
    description: 'Rodillo portador — tren de rodaje D155AX',
    oem_ref: '21T-60-72231',
    compatible_units: ['EPTK-08', 'EPTK-09', 'EPTK-10'],
    stock_quantity: 2,
    stock_minimum: 2,
    location: 'Estante B-7',
    unit_price: 345.0,
    alternatives: [],
  },
  {
    part_number: 'CAT-283-5648',
    description: 'Relay 24V — sistema eléctrico CAT 740B',
    oem_ref: '283-5648',
    compatible_units: ['EPAK-06', 'EPAK-07', 'EPAK-08'],
    stock_quantity: 8,
    stock_minimum: 3,
    location: 'Estante C-1',
    unit_price: 45.0,
    alternatives: ['REL-24V-40A'],
  },
  {
    part_number: 'KOM-6156-81-8300',
    description: 'Filtro de aceite motor SAA6D140E',
    oem_ref: '6156-81-8300',
    compatible_units: ['EPTK-08', 'EPTK-09', 'EPTK-12'],
    stock_quantity: 0,
    stock_minimum: 5,
    location: 'Estante A-1',
    unit_price: 38.75,
    alternatives: ['FO-D140-K'],
  },
  {
    part_number: 'MACK-25164427',
    description: 'Filtro combustible Mack GR84B',
    oem_ref: '25164427',
    compatible_units: ['ULTRATK-01', 'ULTRATK-02', 'ULTRATK-03'],
    stock_quantity: 12,
    stock_minimum: 4,
    location: 'Estante D-2',
    unit_price: 52.0,
    alternatives: ['FF5786', 'P551315'],
  },
];

export default function PartsSearch() {
  const [query, setQuery] = useState('');
  const [selectedEquipo, setSelectedEquipo] = useState('Todos');
  const [results, setResults] = useState<PartResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const equipo = selectedEquipo !== 'Todos' ? selectedEquipo : undefined;
        const data = await searchParts(query, equipo);
        setResults(data);
      } catch {
        const q = query.toLowerCase();
        const equipo = selectedEquipo !== 'Todos' ? selectedEquipo.toLowerCase() : null;
        const filtered = MOCK_PARTS.filter((p) => {
          const matchesQuery =
            p.part_number.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.oem_ref.toLowerCase().includes(q);
          const matchesEquipo = !equipo || p.description.toLowerCase().includes(equipo);
          return matchesQuery && matchesEquipo;
        });
        setResults(filtered.length > 0 ? filtered : MOCK_PARTS.slice(0, 5));
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
      {/* Search bar */}
      <div className="relative mb-3">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por número, descripción o equipo..."
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

      {/* Results */}
      {loading && (
        <p className="text-center text-text-secondary text-sm py-4">Buscando...</p>
      )}
      {!loading && query && results.length === 0 && (
        <p className="text-center text-text-secondary text-sm py-4">No se encontraron resultados</p>
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
