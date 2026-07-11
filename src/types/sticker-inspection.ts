export type StickerInspectionStatus = 'cumple' | 'condicionado' | 'no_cumple' | 'no_aplica';

export type StickerColor = 'green' | 'yellow' | 'red';

export type EquipmentInspectionClass =
  | 'excavadora'
  | 'tractor_oruga'
  | 'camion_articulado'
  | 'cargador_frontal';

export interface StickerInspectionItem {
  id: string;
  section: string;
  label: string;
  hardStop?: boolean;
  defaultDueDays?: number;
  conditionalGuidance?: string;
  failureGuidance?: string;
}

export interface StickerInspectionTemplate {
  id: EquipmentInspectionClass;
  label: string;
  folioPrefix: string;
  sourceFile: string;
  items: StickerInspectionItem[];
}

export interface StickerFindingInput {
  itemId: string;
  status: StickerInspectionStatus;
  canOperate: boolean;
  dueDate?: string;
}

export interface StickerInspectionDecision {
  recommendedColor: StickerColor;
  canDispatch: boolean;
  requiresSupervisorApproval: boolean;
  hardStopItemIds: string[];
  conditionalItemIds: string[];
  findingItemIds: string[];
  badges: string[];
}
