import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, AlertTriangle, Bell, CalendarClock, CalendarDays, ChartNoAxesColumn, ClipboardCheck,
  Database, Disc3, Ellipsis, FileText, Gauge, LayoutDashboard, LogOut, Package, Search, Settings,
  ShoppingCart, Truck, UserRound, Wrench, X, type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useEquipmentList } from '../../hooks/useEquipmentList';
import { canOpenPanamaPayables, sessionHome } from '../../lib/purchasing-home';
import { usePanamaOrderMenuPath } from '../../hooks/usePanamaOrderMenuPath';
import ApiHealthDot from '../ui/ApiHealthDot';
import BottomNav from './BottomNav';

const logo = '/brand/transplus-rescue.jpeg';
const operationsRoles = ['gerencia', 'supervisor', 'coordinador', 'jefe_taller'];

type Entry = [path: string, label: string, Icon: LucideIcon];
type Group = { label: string; items: Entry[] };

function WorkspaceNavigation({ groups, onSelect }: { groups: Group[]; onSelect?: () => void }) {
  return <nav aria-label="Menú de módulos" className="rescue-module-nav">
    {groups.map(group => <div className="rescue-nav-group" key={group.label}>
      <p>{group.label}</p>
      {group.items.map(([path, label, Icon]) => <NavLink key={path} to={path}
        end={path === '/panama'} onClick={onSelect}>
        <Icon aria-hidden size={17} /><span>{label}</span>
      </NavLink>)}
    </div>)}
  </nav>;
}

function WorkspaceSearch({ canSeeFleet, canSeeOrders, canSeeStock }: {
  canSeeFleet: boolean; canSeeOrders: boolean; canSeeStock: boolean;
}) {
  const navigate = useNavigate();
  const equipment = useEquipmentList();
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const term = input.trim();
  const matches = canSeeFleet && term ? equipment.filter(unit =>
    `${unit.unit_id} ${unit.model}`.toLocaleLowerCase('es-PA').includes(term.toLocaleLowerCase('es-PA'))).slice(0, 4) : [];
  const ordersHref = '/workorders?' + new URLSearchParams({ buscar: term });
  const stockHref = '/inventory?' + new URLSearchParams({ buscar: term });
  const fleetHref = (unit: string) => '/fleet?' + new URLSearchParams({ unit });
  const exact = matches.find(unit => unit.unit_id.toUpperCase() === term.toUpperCase());

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!term) return;
    if (exact) navigate(fleetHref(exact.unit_id));
    else if (canSeeOrders && (term.toUpperCase().startsWith('OT') || !canSeeStock)) navigate(ordersHref);
    else if (matches[0]) navigate(fleetHref(matches[0].unit_id));
    else if (canSeeStock) navigate(stockHref);
    setFocused(false);
  }

  return <div className="rescue-workspace-search" onFocus={() => setFocused(true)} onBlur={e => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
  }} onKeyDown={e => { if (e.key === 'Escape') setFocused(false); }}>
    <form className="rescue-search" role="search" onSubmit={submit}>
      <Search size={16} aria-hidden />
      <input aria-label="Buscar equipo, OT o repuesto" placeholder="Buscar equipo, OT o repuesto…" type="search"
        value={input} maxLength={80} onChange={event => { setInput(event.target.value); setFocused(true); }} />
    </form>
    {focused && term && <ul className="rescue-search-results" aria-label="Resultados de búsqueda">
      {matches.map(unit => <li key={unit.unit_id}>
        <Link to={fleetHref(unit.unit_id)} onClick={() => setFocused(false)}>
          <Truck size={16} aria-hidden /><b>{unit.unit_id}</b><span>{unit.model}</span>
        </Link>
      </li>)}
      {canSeeOrders && <li><Link to={ordersHref} onClick={() => setFocused(false)}><Wrench size={16} aria-hidden /> Buscar en órdenes</Link></li>}
      {canSeeStock && <li><Link to={stockHref} onClick={() => setFocused(false)}><Package size={16} aria-hidden /> Buscar en inventario</Link></li>}
    </ul>}
  </div>;
}

export default function PanamaWorkspace({ children }: { children: ReactNode }) {
  const role = useAuthStore(state => state.role);
  const userName = useAuthStore(state => state.userName);
  const demo = useAuthStore(state => state.previewDemo);
  const home = useAuthStore(sessionHome);
  const canReceive = useAuthStore(state => state.canReceivePurchases && !state.canApprovePurchases);
  const canOpenPayables = useAuthStore(canOpenPanamaPayables);
  const logout = useAuthStore(state => state.logout);
  const location = useLocation();
  const orderMenuPath = usePanamaOrderMenuPath();
  const menu = useRef<HTMLDialogElement>(null);
  const [logoutError, setLogoutError] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const canManage = role !== null && operationsRoles.includes(role);
  const canSeeCommand = role === 'gerencia' || role === 'supervisor';
  const canSeeFleet = canSeeCommand || role === 'coordinador';
  const canSeeOrders = canManage || role === 'mecanico';
  const canSeeStock = canManage || role === 'almacen';
  const canSeeShifts = canSeeFleet || role === 'operador';
  const canSeeInspections = canSeeCommand || role === 'operador';
  const isDashboard = /^\/dashboard\/?$/.test(location.pathname);
  const homePath = home.split(/[?#]/)[0];
  const work: Entry[] = [
    canSeeCommand ? ['/dashboard', 'Centro de mando', LayoutDashboard] : [home, 'Inicio', LayoutDashboard],
  ];
  if (role === 'supervisor') work.push(['/supervisor', 'Supervisión', UserRound]);
  if (canSeeShifts) work.push(['/panama/turnos', 'Mi turno', UserRound]);
  if (canSeeOrders) work.push([orderMenuPath, 'Órdenes de trabajo', Wrench]);
  if (canManage) work.push(['/calendar', 'Planificador', CalendarDays]);
  if (role !== 'almacen') {
    work.push(['/falla', 'Fallas', AlertTriangle]);
    work.push([canSeeInspections ? '/dvir' : '/sticker-inspection', 'Inspecciones', ClipboardCheck]);
  }
  const fleet: Entry[] = [];
  if (canSeeFleet) fleet.push(['/fleet', 'Equipos', Truck]);
  if (canSeeCommand) fleet.push(['/panama/disponibilidad', 'Disponibilidad', Activity]);
  if (canManage) fleet.push(['/neumaticos', 'Llantas y componentes', Disc3], ['/pm', 'Mantenimiento PM', CalendarClock]);

  const buying: Entry[] = [];
  if (canSeeStock) buying.push(['/inventory', 'Inventario', Package]);
  if (canManage) buying.push(['/pedidos', 'Compras', ShoppingCart]);
  if (canReceive && (canSeeCommand || homePath !== '/panama/recepciones')) buying.push(['/panama/recepciones', 'Recepciones', Package]);
  if (role === 'gerencia' || role === 'coordinador' || role === 'jefe_taller') buying.push(['/gastos', 'Gastos', FileText]);
  if (canOpenPayables) buying.push([homePath === '/panama/cuentas-por-pagar' ? home : '/panama/cuentas-por-pagar', 'Cuentas por pagar', FileText]);
  if (role === 'mecanico' || role === 'jefe_taller') buying.push(['/parts', 'Catálogo de partes', Package]);

  const reports: Entry[] = [];
  if (canManage) reports.push(['/panama/tiempo-caido', 'Confiabilidad', ChartNoAxesColumn], ['/data', 'Reportes', FileText]);
  if (role !== 'almacen') reports.push(['/panama', 'Maestros TMF', Database]);
  if (canManage && role !== 'supervisor') reports.push(['/briefing', 'Briefing', FileText]);
  if (canManage) reports.push(['/alerts', 'Alertas', Bell]);

  const field: Entry[] = [];
  if (canSeeInspections) field.push(['/sticker-inspection', 'Sticker 15d', ClipboardCheck], ['/flete', 'Fletes', Truck]);
  if (role === 'operador') field.push(['/horometro', 'Horómetro', Gauge]);
  const administration: Entry[] = [];
  if (role === 'gerencia') administration.push(['/admin/activos', 'Activos', Truck],
    ['/admin/proveedores', 'Proveedores', FileText], ['/admin/ordenes-compra', 'Órdenes de compra', ShoppingCart]);
  if (role !== 'almacen') administration.push(['/chat', 'Hermes Chat', Settings]);

  const groups = [
    { label: 'Operación', items: work }, { label: 'Flota', items: fleet },
    { label: 'Abastecimiento', items: buying }, { label: 'Inteligencia', items: reports },
    { label: 'Administración', items: administration }, { label: 'Campo', items: field },
  ].filter(group => group.items.length);
  const allEntries = groups.flatMap(group => group.items);
  const pageTitle = [...allEntries].sort((a, b) => b[0].length - a[0].length)
    .find(([path]) => {
      const prefix = path.split(/[?#]/)[0];
      return location.pathname === prefix || (prefix !== '/panama' && location.pathname.startsWith(prefix + '/'));
    })?.[1] ?? 'Hermes Panamá';
  const initials = userName.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase();

  useEffect(() => {
    menu.current?.close();
  }, [location.pathname]);

  async function signOut() {
    setLeaving(true);
    setLogoutError(false);
    if (await logout()) window.location.replace('/login');
    else { setLogoutError(true); setLeaving(false); }
  }

  return <>
    <aside className="rescue-sidebar">
      <div className="rescue-side-brand"><Link to={canSeeCommand ? '/dashboard' : home} aria-label="Inicio">
        <img src={logo} alt="TransPlus" width="638" height="426" />
      </Link></div>
      <WorkspaceNavigation groups={groups} />
      <div className="rescue-side-bottom">
        <Link to="/perfil"><Settings size={17} aria-hidden /> Configuración</Link>
        <button type="button" onClick={() => void signOut()} disabled={leaving}><LogOut size={17} aria-hidden /> Cerrar sesión</button>
      </div>
    </aside>
    <div className="rescue-workspace">
      <header className="rescue-topbar">
        <div className="rescue-page-label">
          <p>GTP · {demo ? 'PRUEBA' : 'OPERACIÓN'}</p>
          <h2>{pageTitle}</h2>
        </div>
        <Link to={canSeeCommand ? '/dashboard' : home} className="rescue-mobile-brand">
          <span><img src={logo} alt="" width="638" height="426" /></span>
          <span><b>GTP CMMS</b><small>{isDashboard ? 'Inicio de turno' : pageTitle}</small></span>
        </Link>
        <div className="rescue-header-actions">
          {(canSeeFleet || canSeeOrders || canSeeStock) &&
            <WorkspaceSearch canSeeFleet={canSeeFleet} canSeeOrders={canSeeOrders} canSeeStock={canSeeStock} />}
          <button type="button" className="rescue-mobile-menu" onClick={() => menu.current?.showModal()} aria-label="Abrir menú">
            <Ellipsis size={18} aria-hidden />
          </button>
          <ApiHealthDot rescue />
          {canManage && <Link className="rescue-notifications" to="/alerts" aria-label="Notificaciones"><Bell size={18} aria-hidden /></Link>}
          <Link className="rescue-user" to="/perfil" aria-label="Mi perfil">{initials || 'TP'}</Link>
          <button type="button" className="rescue-mobile-logout" aria-label="Cerrar sesión" onClick={() => void signOut()} disabled={leaving}>
            <LogOut size={18} aria-hidden />
          </button>
        </div>
      </header>
      {logoutError && <p role="alert" className="rescue-session-error">No se pudo cerrar la sesión. Reintenta.</p>}
      <main id="main-content" tabIndex={-1} className={isDashboard ? 'rescue-main rescue-main-dashboard' : 'rescue-main'}>
        {children}
      </main>
    </div>
    <BottomNav rescue command={canSeeCommand} orderMenuPath={orderMenuPath} />
    <dialog ref={menu} className="rescue-module-dialog" aria-labelledby="panama-menu-title">
      <div className="rescue-module-dialog-head">
        <h2 id="panama-menu-title">Menú</h2>
        <button type="button" onClick={() => menu.current?.close()} aria-label="Cerrar menú"><X size={20} aria-hidden /></button>
      </div>
      <WorkspaceNavigation groups={groups} onSelect={() => menu.current?.close()} />
      <div className="rescue-side-bottom"><Link to="/perfil" onClick={() => menu.current?.close()}><Settings size={17} aria-hidden /> Configuración</Link></div>
    </dialog>
  </>;
}
