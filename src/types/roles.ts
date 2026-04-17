export type AppRole =
  | 'operador'
  | 'mecanico'
  | 'jefe_taller'
  | 'coordinador'
  | 'supervisor'
  | 'gerencia';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

export const NAV_CONFIG: Record<AppRole, { visible: NavItem[]; overflow: NavItem[] }> = {
  operador: {
    visible: [
      { id: 'inicio',   label: 'Inicio',    icon: 'Home',          path: '/operator' },
      { id: 'reportar', label: 'Reportar',  icon: 'Camera',        path: '/falla' },
      { id: 'dvir',     label: 'Checklist', icon: 'ClipboardCheck',path: '/dvir' },
      { id: 'diesel',   label: 'Diesel',    icon: 'Fuel',          path: '/diesel' },
      { id: 'mas',      label: 'Más',       icon: 'MoreHorizontal',path: '' },
    ],
    overflow: [
      { id: 'horometro', label: 'Horómetro',   icon: 'Gauge',         path: '/horometro' },
      { id: 'fletes',    label: 'Fletes',       icon: 'MapPin',        path: '/flete' },
      { id: 'hermes',    label: 'Hermes Chat',  icon: 'MessageCircle', path: '/chat' },
      { id: 'perfil',    label: 'Perfil',       icon: 'User',          path: '/perfil' },
    ],
  },
  mecanico: {
    visible: [
      { id: 'inicio',  label: 'Inicio',  icon: 'Home',          path: '/mechanic' },
      { id: 'ordenes', label: 'Órdenes', icon: 'Wrench',        path: '/workorders' },
      { id: 'partes',  label: 'Partes',  icon: 'Package',       path: '/parts' },
      { id: 'hermes',  label: 'Hermes',  icon: 'MessageCircle', path: '/chat' },
      { id: 'mas',     label: 'Más',     icon: 'MoreHorizontal',path: '' },
    ],
    overflow: [
      { id: 'manuales',  label: 'Manuales',  icon: 'BookOpen',  path: '/manuals' },
      { id: 'diagramas', label: 'Diagramas', icon: 'FileImage', path: '/diagrams' },
      { id: 'perfil',    label: 'Perfil',    icon: 'User',      path: '/perfil' },
    ],
  },
  jefe_taller: {
    visible: [
      { id: 'inicio',  label: 'Inicio',  icon: 'Home',          path: '/workshop' },
      { id: 'ordenes', label: 'Órdenes', icon: 'Wrench',        path: '/workorders' },
      { id: 'pm',      label: 'PM',      icon: 'Clock',         path: '/pm' },
      { id: 'partes',  label: 'Partes',  icon: 'Package',       path: '/parts' },
      { id: 'mas',     label: 'Más',     icon: 'MoreHorizontal',path: '' },
    ],
    overflow: [
      { id: 'hermes',     label: 'Hermes Chat', icon: 'MessageCircle', path: '/chat' },
      { id: 'calendar',   label: 'Calendario',  icon: 'CalendarDays',  path: '/calendar' },
      { id: 'pm-order',   label: 'Orden PM',    icon: 'CalendarCheck', path: '/pm-order' },
      { id: 'manuales',   label: 'Manuales',    icon: 'BookOpen',      path: '/manuals' },
      { id: 'diagramas',  label: 'Diagramas',   icon: 'FileImage',     path: '/diagrams' },
      { id: 'pedidos',    label: 'Pedidos',     icon: 'ShoppingCart',  path: '/pedidos' },
      { id: 'neumaticos', label: 'Neumáticos',  icon: 'Disc3',         path: '/neumaticos' },
      { id: 'gastos',     label: 'Gastos',      icon: 'Receipt',       path: '/gastos' },
      { id: 'datos',      label: 'Datos',       icon: 'Table2',        path: '/data' },
      { id: 'perfil',     label: 'Perfil',      icon: 'User',          path: '/perfil' },
    ],
  },
  coordinador: {
    visible: [
      { id: 'inicio',    label: 'Inicio',    icon: 'Home',          path: '/coordinator' },
      { id: 'ordenes',   label: 'Órdenes',   icon: 'Wrench',        path: '/workorders' },
      { id: 'pm-order',  label: 'Orden PM',  icon: 'CalendarCheck', path: '/pm-order' },
      { id: 'inventario',label: 'Inventario',icon: 'Package',       path: '/inventory' },
      { id: 'mas',       label: 'Más',       icon: 'MoreHorizontal',path: '' },
    ],
    overflow: [
      { id: 'hermes',   label: 'Hermes Chat',  icon: 'MessageCircle', path: '/chat' },
      { id: 'calendar', label: 'Calendario',  icon: 'CalendarDays',  path: '/calendar' },
      { id: 'pm',       label: 'Programa PM', icon: 'Clock',         path: '/pm' },
      { id: 'pedidos', label: 'Pedidos',     icon: 'ShoppingCart',  path: '/pedidos' },
      { id: 'alertas', label: 'Alertas',     icon: 'AlertTriangle', path: '/alerts' },
      { id: 'gastos',  label: 'Gastos',      icon: 'Receipt',       path: '/gastos' },
      { id: 'datos',   label: 'Datos',       icon: 'Table2',        path: '/data' },
      { id: 'perfil',  label: 'Perfil',      icon: 'User',          path: '/perfil' },
    ],
  },
  supervisor: {
    visible: [
      { id: 'inicio',  label: 'Inicio',  icon: 'Home',          path: '/supervisor' },
      { id: 'equipos', label: 'Equipos', icon: 'Truck',         path: '/fleet' },
      { id: 'viajes',  label: 'Viajes',  icon: 'MapPin',        path: '/viajes-pena' },
      { id: 'alertas', label: 'Alertas', icon: 'AlertTriangle', path: '/alerts' },
      { id: 'mas',     label: 'Más',     icon: 'MoreHorizontal',path: '' },
    ],
    overflow: [
      { id: 'hermes',   label: 'Hermes Chat', icon: 'MessageCircle', path: '/chat' },
      { id: 'calendar', label: 'Calendario',  icon: 'CalendarDays',  path: '/calendar' },
      { id: 'perfil',   label: 'Perfil',      icon: 'User',          path: '/perfil' },
    ],
  },
  gerencia: {
    visible: [
      { id: 'dashboard', label: 'Dashboard', icon: 'BarChart3',    path: '/dashboard' },
      { id: 'ordenes',   label: 'Órdenes',   icon: 'Wrench',       path: '/workorders' },
      { id: 'gastos',    label: 'Gastos',    icon: 'Receipt',      path: '/gastos' },
      { id: 'pedidos',   label: 'Pedidos',   icon: 'ShoppingCart', path: '/pedidos' },
      { id: 'mas',       label: 'Más',       icon: 'MoreHorizontal',path: '' },
    ],
    overflow: [
      { id: 'alertas',  label: 'Alertas',    icon: 'AlertTriangle', path: '/alerts' },
      { id: 'hermes',   label: 'Hermes Chat',icon: 'MessageCircle', path: '/chat' },
      { id: 'calendar', label: 'Calendario', icon: 'CalendarDays',  path: '/calendar' },
      { id: 'perfil',   label: 'Perfil',     icon: 'User',          path: '/perfil' },
      { id: 'briefing', label: 'Briefing',   icon: 'FileText',      path: '/briefing' },
      { id: 'datos',    label: 'Datos',      icon: 'Table2',        path: '/data' },
    ],
  },
};

export const ROLE_HOME: Record<AppRole, string> = {
  operador:    '/operator',
  mecanico:    '/mechanic',
  jefe_taller: '/workshop',
  coordinador: '/coordinator',
  supervisor:  '/supervisor',
  gerencia:    '/dashboard',
};

export const ROLE_LABELS: Record<AppRole, string> = {
  operador:    'Operador',
  mecanico:    'Mecánico',
  jefe_taller: 'Jefe de Taller',
  coordinador: 'Coordinador',
  supervisor:  'Supervisor',
  gerencia:    'Gerencia',
};
