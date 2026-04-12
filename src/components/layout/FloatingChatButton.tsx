import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth-store'

export default function FloatingChatButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const role = useAuthStore(s => s.role)

  const ALLOWED_ROLES = ['mecanico', 'coordinador', 'jefe_taller']
  if (!role || !ALLOWED_ROLES.includes(role)) return null

  if (location.pathname === '/chat') return null

  return (
    <div style={{ position: 'fixed', bottom: '84px', left: '16px', zIndex: 45 }}>
      {/* Pulse ring */}
      <span
        style={{
          position: 'absolute',
          inset: '-4px',
          borderRadius: '50%',
          background: 'rgba(59, 130, 246, 0.3)',
          animation: 'hermesRing 2s ease-out infinite',
        }}
      />

      {/* Button */}
      <button
        onClick={() => navigate('/chat')}
        title="Asistente IA — Diagnóstico inteligente de flota"
        aria-label="Asistente IA — Diagnóstico inteligente de flota"
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(29, 78, 216, 0.5)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          position: 'relative',
        }}
        onMouseEnter={e => {
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.1)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 6px 20px rgba(29, 78, 216, 0.7)'
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'
          ;(e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 4px 16px rgba(29, 78, 216, 0.5)'
        }}
      >
        {/* Bot/brain SVG icon — white */}
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a4 4 0 0 1 4 4v1h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1V6a4 4 0 0 1 4-4z" />
          <circle cx="9" cy="12" r="1" fill="white" stroke="none" />
          <circle cx="15" cy="12" r="1" fill="white" stroke="none" />
          <path d="M9 16s1 1 3 1 3-1 3-1" />
          <line x1="12" y1="2" x2="12" y2="1" />
        </svg>
      </button>

      {/* CSS keyframe for pulse ring */}
      <style>{`
        @keyframes hermesRing {
          0%   { transform: scale(1);   opacity: 0.7; }
          70%  { transform: scale(1.4); opacity: 0;   }
          100% { transform: scale(1.4); opacity: 0;   }
        }
      `}</style>
    </div>
  )
}
