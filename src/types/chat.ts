export interface ChatMessage {
  id: string;
  role: 'user' | 'hermes';
  content: string;
  photo_url?: string;
  timestamp: Date;
  loading?: boolean;
}

export interface DiagnoseResponse {
  causas_probables: string[];
  checklist_diagnostico: string[];
  partes_probables: string[];
  prioridad: string;
}

export interface PhotoAnalysisResponse {
  componente_probable: string;
  tipo_de_dano: string;
  severidad: string;
  recomendacion_inicial: string;
}
