export interface Equipment {
  unit_id: string;
  model: string;
  type: string;
  client: string;
  status: string;
  current_horometro: number;
  next_pm_level: string;
  next_pm_horometro: number;
  last_inspection_date: string;
  last_inspection_result: string;
  assigned_operator: string;
}
