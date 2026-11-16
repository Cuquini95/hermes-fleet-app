const four = ['I1', 'D2', 'I3', 'D4'];
const articulated = [...four, 'I5', 'D6'];
const truck = [...four, 'DE5', 'DI6', 'LI7', 'LE8', 'DE9', 'DI10', 'LI11', 'LE12'];

export function panamaTireLayout(type) {
  const family = String(type ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase().trim();
  if (/CARGADOR/.test(family)) return { positions: four, bases: ['h'] };
  if (/ARTICULADO/.test(family)) return { positions: articulated, bases: ['h', 'km'] };
  if (/CAMION|VOLTEO/.test(family)) return { positions: truck, bases: ['h', 'km'] };
  return null;
}
