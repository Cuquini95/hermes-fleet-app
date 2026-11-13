import type { EquipmentInspectionClass, StickerInspectionTemplate } from '../types/sticker-inspection';

export const STICKER_INSPECTION_TEMPLATES: StickerInspectionTemplate[];
export function getStickerTemplate(templateId: string): StickerInspectionTemplate;

export function stickerTemplateForEquipment(type: string, model: string): EquipmentInspectionClass | '';
