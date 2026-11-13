import { useState, type FormEvent } from 'react';

export default function PasswordRecovery() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<'closed' | 'request' | 'complete'>('closed');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 'closed' || pending) return;
    setPending(true);
    setStatus('');
    setError('');
    try {
      const res = await fetch('/api/auth/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: step, email, ...(step === 'complete' ? { code, password } : {}) }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'No se pudo completar la recuperación.');
      } else if (step === 'request') {
        setStatus(data.message);
        setStep('complete');
      } else {
        setStatus(data.message);
        setEmail('');
        setCode('');
        setStep('closed');
      }
    } catch {
      setError('No se pudo contactar al servicio de recuperación. Intenta nuevamente.');
    } finally {
      setPassword('');
      setPending(false);
    }
  }

  function changeStep(next: typeof step) {
    setStep(next);
    setStatus('');
    setError('');
    setPassword('');
    setCode('');
  }

  const inputClass = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base';
  return (
    <section className="mt-5 space-y-3" aria-label="Recuperación de contraseña">
      {step === 'closed' ? (
        <button type="button" className="min-h-12 text-sm font-semibold text-blue-800 underline" onClick={() => changeStep('request')}>
          Recuperar contraseña
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-300 p-4">
          <h2 className="font-semibold">Recuperar contraseña</h2>
          <label className="block text-sm">
            Correo de recuperación
            <input type="email" autoComplete="email" maxLength={254} required value={email}
              readOnly={step === 'complete'} disabled={pending} className={inputClass}
              onChange={event => setEmail(event.target.value)} />
          </label>
          {step === 'complete' && (
            <>
              <label className="block text-sm">
                Código de recuperación
                <input inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={8}
                  pattern="[0-9]{6,8}" required value={code} disabled={pending} className={inputClass}
                  onChange={event => setCode(event.target.value)} />
              </label>
              <label className="block text-sm">
                Contraseña nueva
                <input type="password" autoComplete="new-password" minLength={12} maxLength={72}
                  required value={password} disabled={pending} className={inputClass}
                  onChange={event => setPassword(event.target.value)} />
              </label>
            </>
          )}
          <button type="submit" disabled={pending} className="min-h-12 w-full rounded-lg bg-blue-900 px-3 text-sm font-semibold text-white disabled:opacity-60">
            {pending ? 'Procesando…' : step === 'request' ? 'Solicitar código' : 'Actualizar contraseña'}
          </button>
          <div className="flex flex-wrap gap-4">
            {step === 'complete' && (
              <button type="button" disabled={pending} className="min-h-12 text-sm underline" onClick={() => changeStep('request')}>
                Solicitar otro código
              </button>
            )}
            <button type="button" disabled={pending} className="min-h-12 text-sm underline" onClick={() => changeStep('closed')}>
              Cancelar recuperación
            </button>
          </div>
        </form>
      )}
      {status && <p role="status" className="text-sm text-slate-700">{status}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>
  );
}
