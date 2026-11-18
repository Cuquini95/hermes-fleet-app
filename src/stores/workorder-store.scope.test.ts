import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useWorkOrderStore } from './workorder-store';
import { useAuthStore } from './auth-store';

let cleanup: (() => void) | undefined;
const reply = () => new Response(JSON.stringify({ orders: [['', 'OT-QA', '', 'EX401', 'Avería', 'Prueba QA', '', 'MEDIA', '', 'Abierta']], history: [], nativeOperations: true }));
beforeEach(() => {
  vi.stubGlobal('window', { setInterval: vi.fn(() => 1), clearInterval: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('document', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
  useAuthStore.setState({ isAuthenticated: true, userId: 'actor-qa', project: 'tmf-panama', role: 'gerencia', allUnits: true, assignedUnits: [] });
  useWorkOrderStore.setState({ workorders: [], statusLog: [], fetched: false, loading: false, error: null });
  cleanup = useWorkOrderStore.getState().initRealtime();
});
afterEach(() => { cleanup?.(); vi.restoreAllMocks(); vi.unstubAllGlobals(); useAuthStore.setState({ isAuthenticated: false, userId: '' }); });

it('retira la lista al reducir el alcance o cambiar el rol del mismo usuario', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(reply());
  await useWorkOrderStore.getState().fetchWorkOrders();
  expect(useWorkOrderStore.getState().workorders).toHaveLength(1);
  useAuthStore.setState({ role: 'mecanico', allUnits: false, assignedUnits: ['DZ203'] });
  expect(useWorkOrderStore.getState().workorders).toEqual([]);
  expect(useWorkOrderStore.getState().fetched).toBe(false);
});

it('una respuesta iniciada con el alcance anterior no puede repoblar la lista', async () => {
  let resolve!: (response: Response) => void;
  vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(done => { resolve = done; }));
  const pending = useWorkOrderStore.getState().fetchWorkOrders();
  useAuthStore.setState({ allUnits: false, assignedUnits: ['DZ203'] });
  resolve(reply()); await pending;
  expect(useWorkOrderStore.getState().workorders).toEqual([]);
  expect(useWorkOrderStore.getState().fetched).toBe(false);
});
