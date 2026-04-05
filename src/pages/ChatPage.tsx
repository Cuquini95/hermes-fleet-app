import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import HermesChat from '../components/chat/HermesChat';

export default function ChatPage() {
  const navigate = useNavigate();

  return (
    <div
      className="flex flex-col"
      style={{ height: '100dvh', backgroundColor: '#F1F5F9' }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        style={{ backgroundColor: '#162252' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1 rounded-lg"
          style={{ color: 'rgba(255,255,255,0.8)' }}
        >
          <ArrowLeft size={22} />
        </button>

        <div className="flex-1">
          <p className="text-white font-semibold text-base leading-tight">
            Hermes — Asistente IA
          </p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Diagnóstico inteligente de flota
          </p>
        </div>

        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-lg"
          style={{ backgroundColor: '#2563EB', color: 'white' }}
        >
          H
        </div>
      </div>

      {/* Chat area fills remaining height */}
      <div className="flex-1 min-h-0 flex flex-col">
        <HermesChat />
      </div>
    </div>
  );
}
