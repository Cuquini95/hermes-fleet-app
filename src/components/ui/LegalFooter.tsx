import { Link } from 'react-router-dom';

const APP_VERSION = '0.0.0'; // Kept in sync with package.json at build time
const LAST_UPDATED = 'Abr 2026';

export default function LegalFooter() {
  return (
    <footer
      className="py-4 px-4 flex flex-col items-center gap-1"
      aria-label="Pie de página legal"
    >
      <nav className="flex items-center gap-4 flex-wrap justify-center" aria-label="Links legales">
        <Link
          to="/privacy"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
        >
          Privacidad
        </Link>
        <span className="text-gray-300 text-xs" aria-hidden="true">·</span>
        <Link
          to="/terms"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
        >
          Términos
        </Link>
        <span className="text-gray-300 text-xs" aria-hidden="true">·</span>
        <a
          href="mailto:soporte@transplus.mx"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
        >
          Contacto
        </a>
      </nav>
      <p className="text-xs text-gray-300">
        Hermes v{APP_VERSION} · {LAST_UPDATED}
      </p>
    </footer>
  );
}
