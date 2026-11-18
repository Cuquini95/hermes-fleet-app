import { useState } from 'react';
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
  const [visible, setVisible] = useState(() => !hasConsented());

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
        className="relative overflow-y-auto rounded-2xl shadow-lg border border-gray-200 p-4"
        style={{ backgroundColor: '#162252', maxHeight: 'calc(var(--app-viewport-height, 100dvh) - 2rem)' }}
      >
        <div className="min-w-0">
          <div className="sticky top-0 z-10 flex min-w-0 items-center justify-between gap-2 bg-[#162252]">
            <p className="min-w-0 break-words text-white text-sm font-medium leading-snug">
              Uso de datos
            </p>
            <button type="button" onClick={() => setVisible(false)} aria-label="Cerrar aviso temporalmente"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-white/70 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="min-w-0">
            <p className="break-words text-white/70 text-xs mt-1 leading-relaxed">
              Hermes usa almacenamiento local (IndexedDB y localStorage) para funcionar sin
              conexión y guardar tu sesión. No usamos cookies de seguimiento de terceros.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <button
                type="button"
                onClick={handleAccept}
                className="min-h-11 px-4 py-1.5 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-75"
                style={{ backgroundColor: '#F59E0B' }}
              >
                Aceptar y continuar
              </button>
              <Link
                to="/privacy"
                className="inline-flex min-h-11 items-center text-white/60 text-xs underline hover:text-white/90 transition-colors"
              >
                Ver aviso completo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
