import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rejectIfRateLimited, resetRateLimits } from '../../api/_rate-limit.js';

function response() {
  const state = { status: 0, body: null, headers: {} };
  return {
    state,
    setHeader(name, value) { state.headers[name] = value; },
    status(code) { state.status = code; return this; },
    json(body) { state.body = body; return this; },
  };
}

test('rate limiter returns 429 with Retry-After after the configured budget', () => {
  resetRateLimits();
  const req = { headers: { 'x-forwarded-for': '198.51.100.10' } };
  const firstResponse = response();
  const secondResponse = response();

  assert.equal(rejectIfRateLimited(req, firstResponse, { scope: 'test', limit: 1 }), false);
  assert.equal(rejectIfRateLimited(req, secondResponse, { scope: 'test', limit: 1 }), true);
  assert.equal(secondResponse.state.status, 429);
  assert.equal(secondResponse.state.body.detail, 'Rate limit exceeded. Try again later.');
  assert.match(secondResponse.state.headers['Retry-After'], /^\d+$/);
});
