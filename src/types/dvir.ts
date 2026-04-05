export type CheckStatus = 'ok' | 'alerta' | 'falla' | null;
export type DVIRResult = 'aprobado' | 'condicional' | 'reprobado';
export type DVIRType = 'pre-operacion' | 'post-operacion';

export interface DVIRSystem {
  id: string;
  label: string;
  icon: string;
}

export interface DVIRCheck {
  system_id: string;
  status: CheckStatus;
  photo_url?: string;
  notes?: string;
}

export interface DVIRInspection {
  unit_id: string;
  type: DVIRType;
  operator: string;
  horometro: number;
  fecha: string;
  hora: string;
  checks: DVIRCheck[];
  result: DVIRResult;
  score: number;
  observations: string;
  ot_generated?: string;
}
