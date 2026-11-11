import { getActiveApp } from './catalog';

export const activeApp = typeof window === 'undefined' ? undefined : getActiveApp(window.location.pathname);
