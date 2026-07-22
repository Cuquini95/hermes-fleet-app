import * as Sentry from '@sentry/react';
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { ROLE_HOME } from '../types/roles';
import type { AppRole } from '../types/roles';

interface Props {
  children: ReactNode;
  /** Current user role — used to navigate to the correct home page */
  role?: AppRole;
  /**
   * Inline variant: renders a compact error panel inside the section
   * instead of taking over the full screen.
   */
  inline?: boolean;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

class InnerBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message ?? 'Error desconocido' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Sentry.captureException is a no-op when SDK not initialized
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  handleGoHome = () => {
    const { role } = this.props;
    const home = role ? ROLE_HOME[role] : '/';
    window.location.href = home;
  };

  render() {
    const { hasError, errorMessage } = this.state;
    const { inline } = this.props;

    if (!hasError) return this.props.children;

    const devError = import.meta.env.DEV && errorMessage ? (
      <p className="text-xs text-red-400 font-mono bg-red-50 rounded p-2 w-full text-left break-words mt-1">
        {errorMessage}
      </p>
    ) : null;

    const actionButtons = (
      <div className="flex gap-2 w-full">
        <button
          type="button"
          onClick={this.handleRetry}
          className="flex-1 text-white rounded-xl py-3 font-semibold transition-opacity"
          style={{ backgroundColor: '#F59E0B' }}
        >
          Reintentar
        </button>
        <button
          type="button"
          onClick={this.handleGoHome}
          className="flex-1 border border-border bg-white text-text rounded-xl py-3 font-semibold transition-colors hover:bg-gray-50"
        >
          Ir al inicio
        </button>
      </div>
    );

    if (inline) {
      return (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center gap-3">
          <span className="text-3xl" aria-hidden="true">⚠️</span>
          <p className="text-sm font-medium text-text">
            Algo salió mal en esta sección.
          </p>
          <p className="text-xs text-text-secondary">
            Puedes intentar nuevamente o regresar al inicio.
          </p>
          {devError}
          {actionButtons}
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50">
        <div
          className="bg-white rounded-xl p-8 shadow-sm border max-w-sm w-full flex flex-col items-center gap-4 text-center"
          style={{ borderColor: '#E2E8F0' }}
        >
          <span className="text-4xl" aria-hidden="true">⚠️</span>
          <h2 className="text-lg font-bold text-text">Algo salió mal en esta sección</h2>
          <p className="text-sm text-text-secondary">
            Puedes intentar nuevamente o regresar al inicio.
          </p>
          {devError}
          {actionButtons}
        </div>
      </div>
    );
  }
}

const SENTRY_FALLBACK = (
  <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50">
    <div
      className="bg-white rounded-xl p-8 shadow-sm border max-w-sm w-full flex flex-col items-center gap-4 text-center"
      style={{ borderColor: '#E2E8F0' }}
    >
      <span className="text-4xl" aria-hidden="true">⚠️</span>
      <h2 className="text-lg font-bold text-text">Algo salió mal</h2>
      <p className="text-sm text-text-secondary">
        Puedes intentar nuevamente o regresar al inicio.
      </p>
      <button
        type="button"
        onClick={() => { window.location.href = '/'; }}
        className="w-full text-white rounded-xl py-3 font-semibold"
        style={{ backgroundColor: '#F59E0B' }}
      >
        Ir al inicio
      </button>
    </div>
  </div>
);

// Create the HOC once so enabling Sentry does not recreate a component per render.
const SentryBoundary = Sentry.withErrorBoundary(InnerBoundary, {
  fallback: SENTRY_FALLBACK,
});

export default function ErrorBoundary({ children, role, inline }: Props) {
  if (import.meta.env.VITE_SENTRY_DSN) {
    return <SentryBoundary role={role} inline={inline}>{children}</SentryBoundary>;
  }
  return <InnerBoundary role={role} inline={inline}>{children}</InnerBoundary>;
}
