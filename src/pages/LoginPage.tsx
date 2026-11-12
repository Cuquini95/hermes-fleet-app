import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ROLE_HOME } from '../types/roles';
import { useAuthStore } from '../stores/auth-store';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [loginError, setLoginError] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const role = useAuthStore((state) => state.role);
  const authenticated = useAuthStore((state) => state.isAuthenticated);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setLoginError(false);
    const success = await login(email, password);
    setPassword('');
    setPending(false);
    const assignedRole = useAuthStore.getState().role;
    if (success && assignedRole) navigate(ROLE_HOME[assignedRole], { replace: true });
    else setLoginError(true);
  }

  if (authenticated && role) return <Navigate to={ROLE_HOME[role]} replace />;

  return (
    <main className="min-h-screen flex flex-col items-center bg-white px-4 py-10 text-navy">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src="/logo-transplus.svg" alt="Trans Plus" className="h-24 w-24" />
          <h1 className="text-2xl font-bold tracking-widest">HERMES</h1>
          <p className="text-sm text-slate-600">Grupo Trans Plus · Operaciones</p>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium">
            Correo de trabajo
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
              type="email" name="email" autoComplete="username" autoCapitalize="none" required maxLength={254}
              value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending}
            />
          </label>
          <label className="block text-sm font-medium">
            Contraseña
            <input
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
              type="password" name="password" autoComplete="current-password" required maxLength={1024}
              value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending}
            />
          </label>
          <button type="submit" disabled={pending} className="w-full rounded-xl bg-[#1E3A8A] py-3 font-semibold text-white disabled:opacity-60">
            {pending ? 'Ingresando…' : 'Ingresar'}
          </button>
          {loginError && (
            <p role="alert" className="text-sm text-red-700">
              No se pudo ingresar. Verifica tus datos o consulta al responsable de tu proyecto.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
