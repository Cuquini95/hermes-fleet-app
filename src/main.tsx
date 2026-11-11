import * as Sentry from '@sentry/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { appUrl } from './apps/catalog';
import { activeApp } from './apps/active-app';

if (activeApp) {
  document.title = `${activeApp.label} · Hermes`;
  document.querySelector('link[rel=manifest]')?.setAttribute('href', `${appUrl(activeApp)}.webmanifest`);
  document.querySelector('meta[name=apple-mobile-web-app-title]')?.setAttribute('content', activeApp.label);
}

// ── Sentry (optional — only initializes when VITE_SENTRY_DSN is set) ───────
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={activeApp ? appUrl(activeApp) : undefined}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
