import { useCallback, useEffect, useState } from 'react';
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
  Table2,
  BadgeCheck,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth-store';
import { useWorkOrderStore } from '../stores/workorder-store';
import { readRange, SHEET_TABS } from '../lib/sheets-api';
import { useEquipmentList } from '../hooks/useEquipmentList';
import { requestWorkshop, type WorkshopMechanic } from '../lib/workshop-api';
import KPICard from '../components/ui/KPICard';
import EquipmentCard from '../components/ui/EquipmentCard';
import OTCard from '../components/ui/OTCard';

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
  { label: 'Calendario', icon: <CalendarCheck size={32} className="text-amber" />, path: '/calendar' },
  { label: 'Sticker 15d', icon: <BadgeCheck size={32} className="text-amber" />, path: '/sticker-inspection' },
  { label: 'Manuales', icon: <BookOpen     size={32} className="text-amber" />, path: '/manuals' },
  { label: 'Diagramas',icon: <FileImage    size={32} className="text-amber" />, path: '/diagrams' },
  { label: 'Neumáticos',icon: <Disc3       size={32} className="text-amber" />, path: '/neumaticos' },
  { label: 'Datos',     icon: <Table2      size={32} className="text-amber" />, path: '/data' },
];

export default function WorkshopHomePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName);
  const equipment = useEquipmentList();

  // ── Real OT data ────────────────────────────────────────────────────────
  const { workorders, fetched, fetchWorkOrders, loading: otLoading, error: otError } = useWorkOrderStore();

  useEffect(() => {
    if (!fetched) fetchWorkOrders();
  }, [fetched, fetchWorkOrders]);

  const otsActivas   = workorders.filter((ot) => ot.estado !== 'Completado');
  const otsEnProceso = workorders.filter((ot) => ot.estado === 'En Reparación');
  const otsPorRecibir = otsActivas.filter((ot) => ['Abierta', 'En Espera de Asignación'].includes(ot.estado));

  // ── En Taller: unique units with active OTs, resolved from catalog ──────
  const unitsEnTaller = [...new Set(otsActivas.map((ot) => ot.unidad).filter(Boolean))];
  const equiposTaller = unitsEnTaller
    .map((uid) => equipment.find((e) => e.unit_id === uid))
    .filter((e): e is (typeof equipment)[0] => e !== undefined);

  // ── Partes Pendientes from Cotizaciones_Pendientes ──────────────────────
  const [partesPendientes, setPartesPendientes] = useState<number | null>(null);
  const [partsError, setPartsError] = useState(false);
  const [mechanicCount, setMechanicCount] = useState<number | null>(null);

  const refreshIndicators = useCallback(() => {
    setPartsError(false);
    void readRange(SHEET_TABS.COTIZACIONES)
      .then((rows) => setPartesPendientes(rows.filter((row) => (row[6] ?? '').trim() === 'Pendiente').length))
      .catch(() => { setPartesPendientes(null); setPartsError(true); });
    void requestWorkshop<{ mechanics: WorkshopMechanic[] }>('mechanics')
      .then(({ mechanics }) => setMechanicCount(mechanics.length))
      .catch(() => setMechanicCount(null));
  }, []);

  useEffect(refreshIndicators, [refreshIndicators]);

  function handleRefresh() {
    void fetchWorkOrders();
    refreshIndicators();
  }

  // ── Greeting ────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches';

  const isLoading = otLoading;

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
          value={otError ? '—' : otLoading || !fetched ? '…' : unitsEnTaller.length}
          label="En Taller"
          color="#DC2626"
        />
        <KPICard
          icon={<ClipboardList size={20} />}
          value={otError ? '—' : otLoading || !fetched ? '…' : otsActivas.length}
          label="OTs Activas"
          color="#2563EB"
        />
        <KPICard
          icon={<Users size={20} />}
          value={mechanicCount ?? '—'}
          label="Mecánicos"
          color="#16A34A"
        />
        <KPICard
          icon={<PackageSearch size={20} />}
          value={partsError ? '—' : partesPendientes ?? '…'}
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

      {otError && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{otError}</p>}
      {partsError && <p role="status" className="mb-3 text-sm text-text-secondary">Partes pendientes sin datos.</p>}

      <h2 className="font-semibold text-text mt-2 mb-3">OTs por recibir</h2>
      <div className="mb-4">
        {!otLoading && fetched && !otError && (
          otsPorRecibir.length > 0 ? otsPorRecibir.map((ot) => (
            <OTCard key={ot.ot_id} workorder={ot} onClick={() => navigate(`/workorders/${ot.ot_id}`)} />
          )) : <p className="text-sm text-text-secondary">Sin órdenes abiertas por recibir.</p>
        )}
      </div>

      {/* En el Taller Ahora */}
      <h2 className="font-semibold text-text mt-2 mb-3">En el Taller Ahora</h2>
      <div className="flex flex-col gap-3 mb-6">
        {otError ? null : otLoading || !fetched ? (
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
        {otError ? null : otLoading || !fetched ? (
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
