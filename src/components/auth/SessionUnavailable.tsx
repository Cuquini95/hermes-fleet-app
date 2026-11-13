import { useAuthStore } from '../../stores/auth-store';

export default function SessionUnavailable() {
  const validateSession = useAuthStore((s) => s.validateSession);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center text-text">
      <h1 className="text-xl font-bold">Sesión pendiente de verificar</h1>
      <p role="status">Sin conexión para verificar la sesión.</p>
      <p className="text-sm text-text-secondary">Tus borradores permanecen en este dispositivo. Vuelve a conectarte para abrir tu cuenta.</p>
      <button type="button" onClick={() => void validateSession()} className="min-h-12 rounded-xl bg-navy px-5 font-semibold text-white">
        Reintentar conexión
      </button>
    </main>
  );
}
