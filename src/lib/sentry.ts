/**
 * Sentry breadcrumb helpers.
 * All functions are safe no-ops when VITE_SENTRY_DSN is not set —
 * the SDK is initialized (or not) in main.tsx before these run.
 */
import * as Sentry from '@sentry/react';

export function breadcrumbNavigation(to: string) {
  Sentry.addBreadcrumb({
    category: 'navigation',
    message: `Navigate → ${to}`,
    level: 'info',
  });
}

export function breadcrumbFormSubmit(formName: string, data?: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    category: 'ui.form',
    message: `Form submitted: ${formName}`,
    level: 'info',
    data,
  });
}

export function breadcrumbApiCall(endpoint: string, method = 'POST') {
  Sentry.addBreadcrumb({
    category: 'http',
    message: `${method} ${endpoint}`,
    level: 'info',
  });
}

export function breadcrumbApiFailure(endpoint: string, status: number | string, message?: string) {
  Sentry.addBreadcrumb({
    category: 'http',
    message: `API failure ${endpoint} — ${status}${message ? ': ' + message : ''}`,
    level: 'error',
    data: { status, message },
  });
}

export function breadcrumbOcr(action: 'start' | 'success' | 'failure') {
  Sentry.addBreadcrumb({
    category: 'ocr',
    message: `OCR ${action}`,
    level: action === 'failure' ? 'warning' : 'info',
  });
}

export { Sentry };
