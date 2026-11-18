import { createHash } from 'node:crypto';

export const PM_CHECKLIST_SOURCE = 'pmChecklists';
const workbook = '1AeTvqR052hJHhEQ7jbkJ3_VIxwPa5ftwGKeVxVlasYw';
const families = new Map([
  ['101', ['D155AX-6', /^(?:KOMATSU)?D155AX6$/]],
  ['102', ['D65EX-16', /^(?:KOMATSU)?D65EX16$/]],
  ['103', ['D8T', /^(?:CAT|CATERPILLAR)?D8T$/]],
  ['104', ['DX360-DX340', /^(?:DEVELON|DOOSAN)?(?:DX360LCA7M|DX340LCAK)$/]],
  ['105', ['EC500FL3', /^(?:VOLVO)?EC500FL3$/]],
  ['106', ['DL420A-7M', /^(?:DEVELON|DOOSAN)?DL420A7M$/]],
  ['107', ['SD110B', /^(?:VOLVO)?SD110B$/]],
  ['108', ['RS7120H', /^(?:SDLG)?RS7120H$/]],
]);

const text = value => String(value ?? '').trim();
const modelKey = value => text(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
export const pmModelCode = value => modelKey(value).replace(/^(?:KOMATSU|CATERPILLAR|CAT|DEVELON|DOOSAN|VOLVO|SDLG)/, '');
const hoursFrom = digits => Number(digits?.replace(/,/g, ''));
const sectionHours = title => /^(?:PM|PRIMERAS)\s+(\d[\d,]*)(?:\s+y\s+(\d[\d,]*))?\b/i.exec(title);

function modelText(value, variant) {
  if (!variant) return value;
  const clauses = value.split(/(?<=\.)\s+(?=DX(?:340|360)\b)/i);
  return clauses.filter(clause => {
    const match = /^DX(340|360)\b/i.exec(clause);
    return !match || match[1] === variant;
  }).join(' ');
}

function checklistSections(rows, variant, limit) {
  const groups = [];
  const intervals = new Set();
  const included = new Set();
  let block;
  for (const row of rows) {
    const [id, label, reference, , , , observation] = row.map(text);
    if (/^HALLAZGOS Y FIRMAS/i.test(label)) break;
    if (id === '▸') {
      const range = sectionHours(label);
      const axle = /^EJES\s*·\s*(\d[\d,]*)\s*h\b/i.exec(label);
      const calendar = /^REFRIGERANTE ELC\b/.test(label);
      const common = /^(?:PREPARACIÓN Y SEGURIDAD|CIERRE Y PRUEBA|INSPECCIÓN (?:DIARIA|DE TURNO|\/ LUBRICACIÓN)|REFERENCIA CF01)\b/i.test(label);
      if (!range && !axle && !calendar && !common) return null;
      const levels = range ? range.slice(1).filter(Boolean).map(hoursFrom) : [];
      if (/^PM\s/i.test(label)) levels.forEach(level => intervals.add(level));
      const hours = levels[0] ?? (axle ? hoursFrom(axle[1]) : calendar ? 500 : 0);
      if (axle) intervals.add(hours);
      block = { title: label, hours, levels, calendar, byHours: new Map() };
      continue;
    }
    if (!/^\d+[A-Z]?$/i.test(id) || !block || !label) continue;
    const title = block.title;
    const taskHours = block.levels.length > 1 ? hoursFrom(/^(\d[\d,]*)\s*h\b/i.exec(label)?.[1]) : block.hours;
    if (!Number.isFinite(taskHours) || (block.levels.length > 1 && !block.levels.includes(taskHours))) return null;
    if (taskHours > limit) continue;
    let action = modelText(label, variant);
    if (!action) continue;
    if (block.calendar) {
      // This row lists the initial check and two later calendar services.
      const initial = /^(.*muestreo inicial\s+500\s*h)\b/i.exec(action);
      if (!initial) return null;
      action = initial[1] + '.';
    }
    let group = block.byHours.get(taskHours);
    if (!group) {
      const note = title.split('·')[1]?.trim();
      group = {
        title: block.levels.length > 1 ? `PM ${taskHours} h${note ? ' · ' + note : ''}` : title,
        tasks: [],
      };
      groups.push(group);
      block.byHours.set(taskHours, group);
    }
    group.tasks.push({ id, label: action, reference: modelText(reference ?? '', variant), observation: observation ?? '' });
    included.add(taskHours);
  }
  return intervals.has(limit) && included.has(limit) && groups.some(group => /^PREPARACIÓN/.test(group.title))
    && groups.some(group => /^CIERRE/.test(group.title)) ? groups : null;
}

export function resolvePanamaPmChecklist(plan, level, snapshot) {
  const link = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)\/edit#gid=(\d+)$/.exec(text(plan.checklist));
  if (link?.[1] !== workbook) return null;
  const family = families.get(link[2]);
  const model = modelKey(plan.model);
  if (!family?.[1].test(model)) return null;
  const document = snapshot.rows.find(sheet => sheet?.id === link[2] && sheet.name === family[0]);
  if (!document || !Array.isArray(document.rows) || document.rows.length > 200 || !document.rows.every(Array.isArray)) return null;
  const variant = family[0] === 'DX360-DX340' ? /DX(340|360)/.exec(model)?.[1] : undefined;
  const sections = checklistSections(document.rows, variant, level);
  if (!sections) return null;
  return {
    unit: plan.unit, model: plan.model, hours: level, sheet: family[0], capturedAt: snapshot.captured_at,
    revision: createHash('sha256').update(JSON.stringify(document.rows)).digest('hex').slice(0, 16),
    approved: modelKey(plan.approved) === 'SI', sections,
  };
}
