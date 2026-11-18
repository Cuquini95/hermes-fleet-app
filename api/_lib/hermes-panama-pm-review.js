import { panamaPmIntervals, pmMasterNumber } from '../../src/lib/panama-pm-next-service.js';
import { pmModelCode, resolvePanamaPmChecklist } from './hermes-panama-pm-checklist.js';

const key = value => String(value ?? '').trim().normalize('NFD').replace(/\p{Diacritic}/gu, '').toUpperCase();
const fields = ['cycle', 'level2', 'level3', 'level4', 'level5', 'level6'];
const validSerial = value => Boolean(String(value ?? '').trim()
  && !/^(?:N\/A|SIN (?:DATO|SERIE)|POR (?:VERIFICAR|CONFIRMAR)|[-—])$/i.test(String(value).trim()));
const checklistLink = value => /^https:\/\/docs\.google\.com\/spreadsheets\/d\/1AeTvqR052hJHhEQ7jbkJ3_VIxwPa5ftwGKeVxVlasYw\/edit#gid=\d+$/.test(value ?? '') ? value : null;

// Inputs have already been projected to the authenticated person's equipment scope.
// This review never changes the source, approves a plan or grants scheduling rights.
export function buildPanamaPmReview(sources, catalog) {
  const rows = name => sources[name]?.records ?? [];
  const find = (name, unit) => rows(name).filter(row => key(row.unit) === unit);
  const units = [...new Set(['fleet', 'maintenance', 'maintenancePlan'].flatMap(name => rows(name).map(row => key(row.unit))))].sort();
  return units.map(unit => {
    const issues = [];
    const add = (code, label, action) => issues.push({ code, label, action });
    const plans = find('maintenancePlan', unit);
    const readings = find('maintenance', unit);
    const equipment = find('equipmentDetails', unit).filter(row => ['TMF', 'TMF MINERA PANAMA'].includes(key(row.project)));
    const plan = plans.length === 1 ? plans[0] : null;
    const detail = equipment.length === 1 ? equipment[0] : null;
    const reading = readings.length === 1 ? readings[0] : null;
    const model = plan?.model || detail?.model || reading?.model || find('fleet', unit)[0]?.model || '';
    const serial = detail && validSerial(detail.serial) ? detail.serial : null;
    if (find('fleet', unit).length > 1) add('fleet_duplicate', 'Código duplicado en flota', 'Operaciones: conciliar el código del equipo antes de programar.');

    if (!sources.maintenancePlan) add('plan_source', 'Plan no disponible', 'Taller: recuperar el maestro de planes y volver a consultar.');
    else if (!plans.length) add('plan_missing', 'Falta el plan', 'Taller: registrar el plan aplicable a este equipo en AJUSTES.');
    else if (plans.length > 1) add('plan_duplicate', 'Plan duplicado', 'Taller: conciliar las filas del mismo equipo en AJUSTES.');
    if (plan && key(plan.active) !== 'SI') add('plan_inactive', 'Plan inactivo', 'Taller y Operaciones: confirmar si corresponde activar este equipo.');
    const approved = Boolean(plan && key(plan.approved) === 'SI');
    if (plan && !approved) add('approval', 'Aprobación pendiente', 'Taller: validar tareas, aplicabilidad y revisión; registrar la aprobación en AJUSTES.');

    if (!sources.equipmentDetails) add('identity_source', 'Identidad no disponible', 'Operaciones y Taller: recuperar el Maestro de Equipos.');
    else if (equipment.length !== 1) add('identity', equipment.length ? 'Equipo duplicado' : 'Falta la identidad TMF', 'Operaciones y Taller: conciliar código, proyecto, modelo y serie con la placa.');
    if (detail && !serial) add('serial', 'Serie por verificar', 'Operaciones y Taller: verificar la placa y completar la serie en el Maestro de Equipos.');
    if (plan && (!plan.model || !detail?.model || pmModelCode(plan.model) !== pmModelCode(detail.model))) {
      add('model', 'Modelo por conciliar', 'Taller: confirmar el mismo modelo en AJUSTES y en el Maestro de Equipos.');
    }

    const intervals = panamaPmIntervals(plan);
    const configured = fields.filter(field => String(plan?.[field] ?? '').trim()).map(field => pmMasterNumber(plan[field]));
    const cycle = pmMasterNumber(plan?.cycle);
    if (plan && (!cycle || !intervals.includes(cycle) || !configured.length
      || configured.some(value => !intervals.includes(value)) || new Set(configured).size !== configured.length
      || intervals.some(value => value % cycle !== 0))) {
      add('intervals', 'Intervalos por revisar', 'Taller: confirmar un ciclo positivo y niveles válidos, sin duplicados, antes de programar.');
    }
    let revision = null;
    const unsupportedIntervals = [];
    if (plan && !checklistLink(plan.checklist)) add('checklist_link', 'Falta vincular el checklist', 'Taller: vincular el documento específico del modelo en AJUSTES.');
    else if (plan && !catalog) add('catalog', 'Catálogo no disponible', 'Planificación: recuperar el corte del catálogo; no sustituir el procedimiento.');
    else if (plan) {
      for (const interval of intervals) {
        const document = resolvePanamaPmChecklist(plan, interval, catalog);
        if (document) revision = document.revision;
        else unsupportedIntervals.push(interval);
      }
      if (unsupportedIntervals.length) add('checklist_coverage', 'Checklist sin cobertura completa',
        `Taller: validar el documento de este modelo para ${unsupportedIntervals.join(', ')} h; no usar otro modelo.`);
    }
    if (!sources.maintenance || readings.length !== 1) add('reading', 'Vencimiento por verificar', 'Planificación: conciliar la fila del equipo en PM FLOTA.');
    else {
      const due = pmMasterNumber(reading.due);
      const current = pmMasterNumber(reading.hours);
      const remaining = pmMasterNumber(reading.remaining);
      if (due === null || current === null || due < 0 || current < 0) add('meter', 'Horómetro o vencimiento sin dato', 'Taller: verificar la lectura y el vencimiento en PM FLOTA.');
      else if (remaining !== null && Math.abs(due - current - remaining) > 0.5) {
        add('balance', 'Saldo de horas por conciliar', 'Planificación: conciliar horas restantes con vencimiento menos horómetro.');
      }
      if (plan && reading.model && pmModelCode(reading.model) !== pmModelCode(plan.model)) {
        add('schedule_model', 'Modelo del programa distinto', 'Taller: conciliar el modelo de PM FLOTA con el plan.');
      }
    }
    return { unit, model, planModel: plan?.model ?? null, equipmentModel: detail?.model ?? null, serial, approved,
      active: plan ? key(plan.active) === 'SI' : null, intervals, unsupportedIntervals,
      checklist: checklistLink(plan?.checklist), revision, issues };
  });
}
