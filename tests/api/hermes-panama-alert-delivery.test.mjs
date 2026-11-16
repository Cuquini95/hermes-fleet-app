import test from 'node:test';
import { exerciseAlertDelivery } from '../../scripts/qa-rollout/alert-delivery-case.mjs';
import * as delivery from '../../api/_lib/hermes-panama-alert-delivery.js';

test('recovers one PM fleet delivery per Panama day before and after receipt loss', async () => {
  await exerciseAlertDelivery(delivery);
});
