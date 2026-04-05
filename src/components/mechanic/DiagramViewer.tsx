import { useState, useEffect } from 'react';
import { Search, FileText, ExternalLink } from 'lucide-react';

const HERMES_API = '/hermes-api';

interface DiagramEntry {
  filename: string;
  name: string;
  url: string;
}

const EQUIPMENT_FILTERS = ['Todos', 'Komatsu', 'CAT', 'Doosan', 'Mack'];

const BRAND_MAP: Record<string, string[]> = {
  'Komatsu': ['D155', 'HM400', 'PC', 'WA', 'HD'],
  'CAT': ['CAT', '740B', '336', '320', '980', '966', '140M', 'D8', 'D9', '3412'],
  'Doosan': ['DX', 'DL'],
  'Mack': ['MACK', 'Pinnacle', 'Granite', 'Anthem'],
};

function matchesBrand(diagramName: string, brand: string): boolean {
  const prefixes = BRAND_MAP[brand];
  if (!prefixes) return false;
  const name = diagramName.toUpperCase();
  return prefixes.some(p => name.includes(p.toUpperCase()));
}

export default function DiagramViewer() {
  const [query, setQuery] = useState('');
  const [selectedEquipo, setSelectedEquipo] = useState('Todos');
  const [diagrams, setDiagrams] = useState<DiagramEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDiagrams() {
      try {
        const res = await fetch(`${HERMES_API}/diagrams/list`);
        if (res.ok) {
          const data = await res.json();
          setDiagrams(data);
        }
      } catch {
        // Fallback mock data if VPS unreachable
        setDiagrams([
          { filename: 'D155AX6_Diagramas.pdf', name: 'D155AX6', url: '/diagrams/file/D155AX6_Diagramas.pdf' },
          { filename: 'HM400-3_Diagramas.pdf', name: 'HM400-3', url: '/diagrams/file/HM400-3_Diagramas.pdf' },
          { filename: 'DX340LC_Diagramas.pdf', name: 'DX340LC', url: '/diagrams/file/DX340LC_Diagramas.pdf' },
          { filename: 'DX225LCA_Diagramas.pdf', name: 'DX225LCA', url: '/diagrams/file/DX225LCA_Diagramas.pdf' },
          { filename: 'DL420A_Diagramas.pdf', name: 'DL420A', url: '/diagrams/file/DL420A_Diagramas.pdf' },
          { filename: 'MACK_GR84B_Diagramas.pdf', name: 'MACK GR84B', url: '/diagrams/file/MACK_GR84B_Diagramas.pdf' },
        ]);
      }
      setLoading(false);
    }
    loadDiagrams();
  }, []);

  const filtered = diagrams.filter((d) => {
    const matchesQuery = !query.trim() || d.name.toLowerCase().includes(query.toLowerCase());
    const matchesEquipo =
      selectedEquipo === 'Todos' || matchesBrand(d.name, selectedEquipo);
    return matchesQuery && matchesEquipo;
  });

  function openPDF(diagram: DiagramEntry) {
    const pdfUrl = `${HERMES_API}${diagram.url}`;
    window.open(pdfUrl, '_blank');
  }

  return (
    <div className="flex flex-col py-4">
      <div className="relative mb-3">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar diagrama por equipo..."
          className="w-full bg-white rounded-xl border-2 border-border focus:border-amber outline-none pl-11 pr-4 py-4 text-sm text-text placeholder:text-text-secondary"
        />
      </div>

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

      {loading && (
        <p className="text-center text-text-secondary text-sm py-8">Cargando diagramas...</p>
      )}

      {filtered.map((diagram) => (
        <div
          key={diagram.filename}
          className="bg-card rounded-xl shadow-sm border border-border p-4 mb-3 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF3C7' }}>
              <FileText size={20} style={{ color: '#E8961A' }} />
            </div>
            <div>
              <p className="font-semibold text-text text-sm">{diagram.name} — Diagramas</p>
              <p className="text-xs text-text-secondary mt-0.5">PDF técnico</p>
            </div>
          </div>
          <button
            onClick={() => openPDF(diagram)}
            className="flex-shrink-0 bg-amber text-white rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap hover:opacity-90 transition-opacity flex items-center gap-1"
          >
            <ExternalLink size={14} />
            Abrir PDF
          </button>
        </div>
      ))}

      {!loading && filtered.length === 0 && (
        <p className="text-center text-text-secondary text-sm py-8">
          No se encontraron diagramas
        </p>
      )}
    </div>
  );
}
