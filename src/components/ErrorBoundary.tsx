import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-50">
          <div
            className="bg-white rounded-xl p-8 shadow-sm border border-border max-w-sm w-full flex flex-col items-center gap-4 text-center"
            style={{ borderColor: '#E2E8F0' }}
          >
            <span className="text-4xl">⚠️</span>
            <h2 className="text-lg font-bold text-text">Algo salió mal</h2>
            <p className="text-sm text-text-secondary">
              Ocurrió un error inesperado. Por favor, recarga la página.
            </p>
            <button
              type="button"
              onClick={this.handleRetry}
              className="w-full bg-amber text-white rounded-xl py-3 font-semibold transition-opacity"
              style={{ backgroundColor: '#F59E0B' }}
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
