import { useState } from 'react';
import { Search, X } from 'lucide-react';

interface DiagramEntry {
  id: string;
  title: string;
  pages: number;
}

const MOCK_DIAGRAMS: DiagramEntry[] = [
  { id: 'd1', title: 'D155AX-6 — Sistema Hidráulico', pages: 48 },
  { id: 'd2', title: 'HM400-3 — Motor SAA6D140E', pages: 62 },
  { id: 'd3', title: 'CAT 740B — Transmisión y Diferencial', pages: 35 },
  { id: 'd4', title: 'Doosan DX340LC — Sistema Eléctrico', pages: 54 },
  { id: 'd5', title: 'Mack GR84B — Circuito de Frenos', pages: 29 },
  { id: 'd6', title: 'D65EX-16 — Tren de Rodaje', pages: 41 },
  { id: 'd7', title: 'Doosan DL420A — Sistema de Enfriamiento', pages: 33 },
];

const EQUIPMENT_FILTERS = ['Todos', 'Komatsu', 'CAT', 'Doosan', 'Mack'];

export default function DiagramViewer() {
  const [query, setQuery] = useState('');
  const [selectedEquipo, setSelectedEquipo] = useState('Todos');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDiagram, setSelectedDiagram] = useState<DiagramEntry | null>(null);

  const filtered = MOCK_DIAGRAMS.filter((d) => {
    const matchesQuery = !query.trim() || d.title.toLowerCase().includes(query.toLowerCase());
    const matchesEquipo =
      selectedEquipo === 'Todos' || d.title.toLowerCase().includes(selectedEquipo.toLowerCase());
    return matchesQuery && matchesEquipo;
  });

  function openDiagram(diagram: DiagramEntry) {
    setSelectedDiagram(diagram);
    setModalOpen(true);
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
          placeholder="Buscar diagrama por equipo o sistema..."
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
      {filtered.map((diagram) => (
        <div
          key={diagram.id}
          className="bg-card rounded-xl shadow-sm border border-border p-4 mb-3 flex items-center justify-between gap-3"
        >
          <div>
            <p className="font-semibold text-text text-sm">{diagram.title}</p>
            <p className="text-xs text-text-secondary mt-0.5">{diagram.pages} páginas</p>
          </div>
          <button
            onClick={() => openDiagram(diagram)}
            className="flex-shrink-0 bg-amber text-white rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap hover:opacity-90 transition-opacity"
          >
            Ver Diagrama →
          </button>
        </div>
      ))}

      {filtered.length === 0 && (
        <p className="text-center text-text-secondary text-sm py-8">
          No se encontraron diagramas
        </p>
      )}

      {/* Modal */}
      {modalOpen && selectedDiagram && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 className="font-semibold text-text text-base leading-tight pr-2">
                Diagrama PDF
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-text-secondary hover:text-text transition-colors flex-shrink-0"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-text-secondary mb-2">{selectedDiagram.title}</p>
            <div
              className="bg-cream rounded-xl p-4 text-center"
              style={{ backgroundColor: '#F5F0E8' }}
            >
              <p className="text-sm font-medium text-text-secondary">
                En fase de integración con VPS
              </p>
              <p className="text-xs text-text-secondary mt-1">
                Los PDFs estarán disponibles cuando el servidor Hermes esté conectado
              </p>
            </div>
            <button
              onClick={() => setModalOpen(false)}
              className="mt-4 w-full border-2 border-border text-text-secondary rounded-xl py-2.5 text-sm font-medium hover:border-amber hover:text-amber transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
