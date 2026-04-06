import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Clock,
  Package,
  CalendarCheck,
  BookOpen,
  FileImage,
  HardHat,
  ClipboardList,
  Users,
  PackageSearch,
  Disc3,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useWorkOrderStore } from '../stores/workorder-store';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { EQUIPMENT_CATALOG } from '../data/equipment-catalog';
import KPICard from '../components/ui/KPICard';
import EquipmentCard from '../components/ui/EquipmentCard';
import OTCard from '../components/ui/OTCard';

const MECANICOS_HEADCOUNT = 12;

interface ActionCard {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const ACTION_CARDS: ActionCard[] = [
  { label: 'Órdenes',  icon: <Wrench       size={32} className="text-amber" />, path: '/workorders' },
  { label: 'PM',       icon: <Clock        size={32} className="text-amber" />, path: '/pm' },
  { label: 'Partes',   icon: <Package      size={32} className="text-amber" />, path: '/parts' },
  { label: 'Orden PM', icon: <CalendarCheck size={32} className="text-amber" />, path: '/pm-order' },
  { label: 'Manuales', icon: <BookOpen     size={32} className="text-amber" />, path: '/manuals' },
  { label: 'Diagramas',icon: <FileImage    size={32} className="text-amber" />, path: '/diagrams' },
  { label: 'Neumáticos',icon: <Disc3       size={32} className="text-amber" />, path: '/neumaticos' },
];

export default function WorkshopHomePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);

  // ── Real OT data ────────────────────────────────────────────────────────
  const { workorders, fetched, fetchWorkOrders, loading: otLoading } = useWorkOrderStore();

  useEffect(() => {
    if (!fetched) fetchWorkOrders();
  }, [fetched, fetchWorkOrders]);

  const otsActivas   = workorders.filter((ot) => ot.estado !== 'Completado');
  const otsEnProceso = workorders.filter((ot) => ot.estado === 'En Proceso');

  // ── En Taller: unique units with active OTs, resolved from catalog ──────
  const unitsEnTaller = [...new Set(otsActivas.map((ot) => ot.unidad).filter(Boolean))];
  const equiposTaller = unitsEnTaller
    .map((uid) => EQUIPMENT_CATALOG.find((e) => e.unit_id === uid))
    .filter((e): e is (typeof EQUIPMENT_CATALOG)[0] => e !== undefined);

  // ── Partes Pendientes from Cotizaciones_Pendientes ──────────────────────
  const [partesPendientes, setPartesPendientes] = useState<number | null>(null);

  useEffect(() => {
    readRange(SHEET_TABS.COTIZACIONES)
      .then((rows) => {
        const count = rows.slice(1).filter((r) => (r[6] ?? '').trim() === 'Pendiente').length;
        setPartesPendientes(count);
      })
      .catch(() => setPartesPendientes(0));
  }, []);

  // ── Refresh all ─────────────────────────────────────────────────────────
  function handleRefresh() {
    useWorkOrderStore.setState({ fetched: false });
    fetchWorkOrders();
    setPartesPendientes(null);
    readRange(SHEET_TABS.COTIZACIONES)
      .then((rows) => {
        const count = rows.slice(1).filter((r) => (r[6] ?? '').trim() === 'Pendiente').length;
        setPartesPendientes(count);
      })
      .catch(() => setPartesPendientes(0));
  }

  // ── Greeting ────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  const isLoading = otLoading || partesPendientes === null;

  return (
    <div className="flex flex-col py-4 animate-fade-up">
      {/* Greeting */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-text">{greeting}, {userName}</h1>
          <p className="text-text-secondary text-sm mt-0.5">Jefe de Taller</p>
        </div>
        <button
          onClick={handleRefresh}
          className="p-2 rounded-full"
          style={{ color: '#162252' }}
          aria-label="Actualizar"
        >
          <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPI grid 2×2 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <KPICard
          icon={<HardHat size={20} />}
          value={otLoading ? '…' : equiposTaller.length}
          label="En Taller"
          color="#DC2626"
        />
        <KPICard
          icon={<ClipboardList size={20} />}
          value={otLoading ? '…' : otsActivas.length}
          label="OTs Activas"
          color="#2563EB"
        />
        <KPICard
          icon={<Users size={20} />}
          value={MECANICOS_HEADCOUNT}
          label="Mecánicos"
          color="#16A34A"
        />
        <KPICard
          icon={<PackageSearch size={20} />}
          value={partesPendientes === null ? '…' : partesPendientes}
          label="Partes Pendientes"
          color="#F59E0B"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {ACTION_CARDS.map(({ label, icon, path }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex flex-col items-center justify-center gap-2 bg-white rounded-xl p-4 shadow-sm border border-border btn-press"
            style={{ minHeight: 100 }}
          >
            {icon}
            <span className="text-sm font-medium text-center text-text">{label}</span>
          </button>
        ))}
      </div>

      {/* En el Taller Ahora */}
      <h2 className="font-semibold text-text mt-2 mb-3">En el Taller Ahora</h2>
      <div className="flex flex-col gap-3 mb-6">
        {otLoading ? (
          <div className="text-center py-6 text-text-secondary text-sm">Cargando…</div>
        ) : equiposTaller.length > 0 ? (
          equiposTaller.map((equipment) => (
            <EquipmentCard key={equipment.unit_id} equipment={equipment} />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">Taller vacío ✓</p>
          </div>
        )}
      </div>

      {/* OTs en Proceso */}
      <h2 className="font-semibold text-text mt-2 mb-3">OTs en Proceso</h2>
      <div className="flex flex-col">
        {otLoading ? (
          <div className="text-center py-6 text-text-secondary text-sm">Cargando…</div>
        ) : otsEnProceso.length > 0 ? (
          otsEnProceso.map((ot) => (
            <OTCard
              key={ot.ot_id}
              workorder={ot}
              onClick={() => navigate(`/workorders/${ot.ot_id}`)}
            />
          ))
        ) : (
          <div className="bg-green-50 border border-success rounded-lg p-3">
            <p className="text-sm font-medium text-success text-center">Sin órdenes en proceso ✓</p>
          </div>
        )}
      </div>
    </div>
  );
}
