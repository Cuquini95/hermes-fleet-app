import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';

const CONSENT_KEY = 'hermes-privacy-accepted-v1';

function hasConsented(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'true';
  } catch {
    return true; // If localStorage is blocked, don't nag
  }
}

function storeConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, 'true');
  } catch {
    // Not critical
  }
}

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show after hydration to avoid SSR mismatch
    if (!hasConsented()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleAccept = () => {
    storeConsent();
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Aviso de privacidad"
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
    >
      <div
        className="rounded-2xl shadow-lg border border-gray-200 p-4"
        style={{ backgroundColor: '#162252' }}
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="text-white text-sm font-medium leading-snug">
              Almacenamiento local
            </p>
            <p className="text-white/70 text-xs mt-1 leading-relaxed">
              Hermes usa almacenamiento local (IndexedDB y localStorage) para funcionar sin
              conexión y guardar tu sesión. No usamos cookies de seguimiento de terceros.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={handleAccept}
                className="px-4 py-1.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75"
                style={{ backgroundColor: '#F59E0B' }}
              >
                Aceptar y continuar
              </button>
              <Link
                to="/privacy"
                className="text-white/60 text-xs underline hover:text-white/90 transition-colors"
              >
                Ver aviso completo
              </Link>
            </div>
          </div>
          {/* Dismiss without explicit consent — banner will re-appear next session */}
          <button
            type="button"
            onClick={() => setVisible(false)}
            aria-label="Cerrar aviso temporalmente"
            className="text-white/50 hover:text-white/80 transition-colors shrink-0 mt-0.5"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
