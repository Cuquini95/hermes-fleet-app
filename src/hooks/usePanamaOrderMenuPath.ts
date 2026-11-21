import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';

const listPath = '/workorders';

function orderFilterQuery(search: string) {
  const source = new URLSearchParams(search);
  const filters = new URLSearchParams();
  for (const key of ['buscar', 'estado', 'prioridad']) {
    const value = source.get(key);
    if (value) filters.set(key, value.slice(0, 100));
  }
  return filters.toString();
}

export function usePanamaOrderMenuPath() {
  const { pathname, search } = useLocation();
  const userId = useAuthStore(s => s.userId);
  const role = useAuthStore(s => s.role);
  const storageKey = 'hermes:tmf-panama:ot-filtros:' + JSON.stringify([userId, role]);
  const onList = pathname === listPath || pathname === listPath + '/';
  let query = onList ? orderFilterQuery(search) : '';
  if (!onList && userId) {
    try { query = orderFilterQuery(sessionStorage.getItem(storageKey) ?? ''); }
    catch { /* The unfiltered list remains accessible without browser storage. */ }
  }

  useLayoutEffect(() => {
    if (!onList || !userId) return;
    try {
      if (query) sessionStorage.setItem(storageKey, query);
      else sessionStorage.removeItem(storageKey);
    } catch { /* Explicit filters still work through the URL. */ }
  }, [onList, query, storageKey, userId]);

  return query ? listPath + '?' + query : listPath;
}
