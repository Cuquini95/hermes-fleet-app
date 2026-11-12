import { Link } from 'react-router-dom';

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-xl font-bold">Aviso de privacidad</h1>
      <p className="my-4">Hermes Panamá · Entorno de validación interna de TMF Minera Panamá.</p>
      <p className="my-4">Documento oficial de Panamá pendiente de incorporación.</p>
      <Link to="/" className="text-blue-700 underline">Volver a Hermes Panamá</Link>
    </main>
  );
}
