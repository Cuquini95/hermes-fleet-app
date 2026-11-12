import damageHandler from '../_lib/cmms-damage.js';
import meterHandler from '../_lib/cmms-meter.js';

const handlers = Object.freeze({
  damage: damageHandler,
  meter: meterHandler,
});

export default async function handler(req, res) {
  if (['1', 'true'].includes(process.env.HERMES_READ_ONLY) || (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production')) {
    return res.status(503).json({ detail: 'Sincronización CMMS en pausa. Usa el procedimiento vigente de tu área.' });
  }
  const action = Array.isArray(req.query?.action) ? req.query.action[0] : req.query?.action;
  const selected = handlers[action];

  if (!selected) {
    return res.status(404).json({ detail: 'CMMS route not found.' });
  }

  return selected(req, res);
}
