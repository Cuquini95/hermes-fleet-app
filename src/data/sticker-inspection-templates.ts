import type { StickerInspectionTemplate } from '../types/sticker-inspection';

const COMMON_SAFETY = [
  {
    id: 'combustible_fugas',
    section: 'Combustible',
    label: 'Sin fugas en tanque, filtros, lineas, bombas y toma de llenado rapido.',
    hardStop: true,
    failureGuidance: 'Debe cumplir: fuga de combustible rechaza la unidad.',
  },
  {
    id: 'frenos_prueba',
    section: 'Frenos',
    label: 'Prueba de freno de servicio y estacionamiento con apoyo del operador.',
    hardStop: true,
    failureGuidance: 'Debe cumplir: falla de frenos bloquea despacho.',
  },
  {
    id: 'cinturon_seguridad',
    section: 'Cabina y accesorios',
    label: 'Cinturon sin cortes, sin deshilado y con retraccion/enganche correcto.',
    hardStop: true,
    failureGuidance: 'Debe cumplir por seguridad del operador.',
  },
  {
    id: 'extintor_vigente',
    section: 'Cabina y accesorios',
    label: 'Extintor con presion, vigencia, base segura y salida facil.',
    defaultDueDays: 1,
    conditionalGuidance: 'Condicionado 1 dia solo si requiere cambio simple de extintor.',
    failureGuidance: 'No cumple si no tiene base o no puede retirarse facil.',
  },
  {
    id: 'luces_alarmas',
    section: 'Sistema electrico',
    label: 'Luces de trabajo, claxon, alarma de reversa y torreta/farola operativas.',
    defaultDueDays: 1,
    conditionalGuidance: 'Condicionado 1 dia; si opera de noche puede bloquearse.',
  },
  {
    id: 'camaras_alertas',
    section: 'Cabina y accesorios',
    label: 'Camaras, alertas, indicadores y horometro funcionando sin alarmas activas.',
    hardStop: true,
    failureGuidance: 'Debe cumplir cuando afecta frenos, seguridad o trazabilidad.',
  },
  {
    id: 'acceso_tres_puntos',
    section: 'Cabina y accesorios',
    label: 'Escalones, estribos, pasamanos y tres puntos de apoyo seguros.',
    defaultDueDays: 15,
    conditionalGuidance: 'Condicionado solo por dano leve sin riesgo de acceso.',
    failureGuidance: 'No cumple si faltan tres puntos de apoyo o hay riesgo de lesion.',
  },
  {
    id: 'rops_estructura',
    section: 'Chasis / ROPS',
    label: 'ROPS, bastidor, soportes y tornilleria sin fisuras, deformacion ni juego severo.',
    hardStop: true,
    failureGuidance: 'Debe cumplir cuando hay dano estructural severo.',
  },
] satisfies StickerInspectionTemplate['items'];

export const STICKER_INSPECTION_TEMPLATES: StickerInspectionTemplate[] = [
  {
    id: 'excavadora',
    label: 'Excavadora',
    folioPrefix: 'IMI-EXC',
    sourceFile: 'Excavadora.pdf',
    items: [
      {
        id: 'motor_escape_soportes',
        section: 'Motor diesel',
        label: 'Multiple de escape/admision, soportes de motor, radiador, poleas, bandas y turbo sin fuga ni dano.',
        hardStop: true,
        failureGuidance: 'Debe cumplir en soportes y fuga de aceite por turbo.',
      },
      {
        id: 'hidraulico_mangueras',
        section: 'Sistema hidraulico',
        label: 'Mangueras, bombas, cilindros y lineas sin alambres expuestos, goteo constante ni hilos de aceite.',
        hardStop: true,
        failureGuidance: 'No se permiten goteos ni mangueras con alambres expuestos.',
      },
      {
        id: 'giro_candado',
        section: 'Sistema hidraulico',
        label: 'Motor de giro 360 grados y candado hidraulico funcionan y se detienen al soltar palancas.',
        hardStop: true,
        failureGuidance: 'Debe cumplir por control operacional.',
      },
      {
        id: 'tracks_corona',
        section: 'Tracks, corona y chasis',
        label: 'Ruedas guia, rodillos, cadenas, catarinas, tensor y corona sin fuga severa, tornillos faltantes ni desgaste riesgoso.',
        defaultDueDays: 15,
        conditionalGuidance: 'Condicionado solo por humedad ligera o desgaste normal sin riesgo.',
      },
      {
        id: 'implemento_cucharon',
        section: 'Implementos',
        label: 'Cucharon, brazo, puntas, placas de desgaste, pernos y chumaceras sin fisuras ni juego excesivo.',
        defaultDueDays: 15,
        failureGuidance: 'Rechazar si punta destapada, fisura critica o juego excesivo.',
      },
      ...COMMON_SAFETY,
    ],
  },
  {
    id: 'tractor_oruga',
    label: 'Tractor de oruga',
    folioPrefix: 'IMI-TOR',
    sourceFile: 'Tractor de oruga.pdf',
    items: [
      {
        id: 'motor_turbo_guardas',
        section: 'Motor diesel',
        label: 'Escape, admision, soportes, turbo, poleas, bandas y guardas sin fuga ni dano critico.',
        hardStop: true,
        failureGuidance: 'Debe cumplir en soportes y turbo; poleas danadas rechazan.',
      },
      {
        id: 'transmision_mandos',
        section: 'Transmision',
        label: 'Transmision engancha frente/reversa, convertidor, mandos finales y crucetas sin fuga o tornilleria floja.',
        hardStop: true,
        failureGuidance: 'Debe cumplir si no engancha o hay falla de mando final.',
      },
      {
        id: 'track_carriles',
        section: 'Track o carriles',
        label: 'Ruedas guia, rodillos, cadena, eslabones, zapatas, tensor y bastidor sin fuga severa ni riesgo de desbande.',
        defaultDueDays: 15,
        conditionalGuidance: 'Condicionado solo si el desgaste es normal y seguro.',
      },
      {
        id: 'hidraulico_cuchilla_ripper',
        section: 'Sistema hidraulico',
        label: 'Cilindros, mangueras y lineas de cuchilla/ripper sin goteo constante ni alambres expuestos.',
        hardStop: true,
        failureGuidance: 'No se permiten goteos ni alambres expuestos.',
      },
      {
        id: 'implementos_cuchilla_ripper',
        section: 'Implementos',
        label: 'Hoja topadora, gavilanes, brazos de empuje, ripper, zanco y punta sin grietas ni juego excesivo.',
        defaultDueDays: 15,
      },
      ...COMMON_SAFETY,
    ],
  },
  {
    id: 'camion_articulado',
    label: 'Camion articulado',
    folioPrefix: 'SEGPROY-CAM',
    sourceFile: 'CAMION ARTICULADO.pdf',
    items: [
      {
        id: 'motor_combustion',
        section: 'Motor',
        label: 'Motor, escape, turbo, protecciones, enfriamiento y lubricacion sin fuga ni dano critico.',
        hardStop: true,
      },
      {
        id: 'transmision_cardanes',
        section: 'Transmision',
        label: 'Transmision, caja de transferencia, yugas, cardanes y crucetas sin fuga, juego ni tornilleria floja.',
        hardStop: true,
      },
      {
        id: 'direccion_auxiliar',
        section: 'Direccion',
        label: 'Direccion principal y auxiliar responden; cilindros, valvulas, orbit-rol y mangueras sin fuga severa.',
        hardStop: true,
        failureGuidance: 'Si la direccion auxiliar no responde, rechazar unidad.',
      },
      {
        id: 'frenos_acumuladores',
        section: 'Frenos',
        label: 'Paquetes, acumuladores, bombas, indicadores y pruebas de freno sin fuga y dentro de especificacion.',
        hardStop: true,
      },
      {
        id: 'suspension_articulacion',
        section: 'Suspension / chasis',
        label: 'Suspension, rotulas, tensores, king bolt, caja, pivotes y articulacion sin fuga, fisura ni juego severo.',
        defaultDueDays: 15,
      },
      {
        id: 'somnolencia_identificacion',
        section: 'Cabina y accesorios',
        label: 'Sistema de somnolencia, identificacion economica, camaras y alarmas operativas.',
        defaultDueDays: 30,
      },
      ...COMMON_SAFETY,
    ],
  },
  {
    id: 'cargador_frontal',
    label: 'Cargador frontal',
    folioPrefix: 'IMI-CF',
    sourceFile: 'Cargador frontal.pdf',
    items: [
      {
        id: 'motor_mantas_termicas',
        section: 'Motor diesel',
        label: 'Motor, escape, turbo, guardas y mantas termicas en componentes de alta temperatura.',
        hardStop: true,
        failureGuidance: 'Debe cumplir por riesgo de conato de incendio.',
      },
      {
        id: 'transmision_diferenciales',
        section: 'Transmision',
        label: 'Enganche suave frente/reversa; lineas, convertidor, diferenciales y crucetas sin fuga ni tornilleria floja.',
        hardStop: true,
      },
      {
        id: 'direccion_joystick',
        section: 'Direccion',
        label: 'Cilindros, bomba, joystick/palanca y volante responden completo sin dureza, juego severo ni fuga.',
        hardStop: true,
      },
      {
        id: 'hidraulico_levante_inclinacion',
        section: 'Sistema hidraulico',
        label: 'Cilindros de levante/inclinacion, tanque, bomba, tubos y abrazaderas sin goteo ni alambres expuestos.',
        hardStop: true,
      },
      {
        id: 'implemento_cucharon_brazos',
        section: 'Implementos',
        label: 'Cucharon, mamelones, orejas, puntas, adaptadores, brazos y placas sin fisuras ni desgaste critico.',
        defaultDueDays: 15,
        failureGuidance: 'Rechazar cuando existan fisuras.',
      },
      ...COMMON_SAFETY,
    ],
  },
];

export function getStickerTemplate(templateId: string): StickerInspectionTemplate {
  const fallback = STICKER_INSPECTION_TEMPLATES[0];
  if (!fallback) throw new Error('No sticker inspection templates configured');
  return STICKER_INSPECTION_TEMPLATES.find((template) => template.id === templateId) ?? fallback;
}
