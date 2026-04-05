import type { DVIRSystem } from '../types/dvir';

export const DVIR_SYSTEMS: DVIRSystem[] = [
  { id: 'motor', label: 'Motor', icon: 'Cog' },
  { id: 'transmision', label: 'Transmisión', icon: 'Settings' },
  { id: 'frenos', label: 'Frenos', icon: 'CircleStop' },
  { id: 'direccion', label: 'Dirección', icon: 'Navigation' },
  { id: 'hidraulico', label: 'Hidráulico', icon: 'Droplets' },
  { id: 'electrico', label: 'Eléctrico', icon: 'Zap' },
  { id: 'neumaticos', label: 'Neumáticos', icon: 'Circle' },
  { id: 'estructura', label: 'Estructura', icon: 'Box' },
  { id: 'luces', label: 'Luces', icon: 'Lightbulb' },
  { id: 'fluidos', label: 'Fluidos', icon: 'Beaker' },
  { id: 'cabina', label: 'Cabina', icon: 'LayoutDashboard' },
  { id: 'tren_rodaje', label: 'Tren de Rodaje', icon: 'Footprints' },
];
