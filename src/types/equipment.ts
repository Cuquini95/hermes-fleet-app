export interface Equipment {
  unit_id: string;
  model: string;
  type: 'Bulldozer' | 'Camión Articulado' | 'Cargador' | 'Excavadora' | 'Camión Pesado';
  client: string;
  status: 'operativo' | 'alerta' | 'taller' | 'inactivo';
  current_horometro: number;
  next_pm_level: string;
  next_pm_horometro: number;
  last_inspection_date: string;
  last_inspection_result: 'aprobado' | 'condicional' | 'reprobado';
  assigned_operator: string;
}
