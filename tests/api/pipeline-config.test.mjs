import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pipelineSource = fs.readFileSync(path.join(repoRoot, 'test-pipeline.mjs'), 'utf8');
const vercelConfig = JSON.parse(fs.readFileSync(path.join(repoRoot, 'vercel.json'), 'utf8'));
const indexSource = fs.readFileSync(path.join(repoRoot, 'index.html'), 'utf8');

test('live pipeline Storage credentials are supplied explicitly through the environment', () => {
  assert.match(pipelineSource, /process\.env\.HERMES_PIPELINE_SUPABASE_URL/);
  assert.match(pipelineSource, /process\.env\.HERMES_PIPELINE_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(pipelineSource, /const SUPABASE_URL\s*=\s*['"]/);
  assert.doesNotMatch(pipelineSource, /const SUPABASE_ANON_KEY\s*=\s*\n?\s*['"]/);
  assert.match(pipelineSource, /refusing to run live Storage tests/);
});

test('CSP frame-ancestors is delivered as an HTTP header, not a meta directive', () => {
  const headers = vercelConfig.headers.flatMap((entry) => entry.headers);
  const csp = headers.find((header) => header.key.toLowerCase() === 'content-security-policy');
  assert.ok(csp, 'Vercel CSP header must be configured');
  assert.match(csp.value, /frame-ancestors 'none'/);
  assert.doesNotMatch(indexSource, /frame-ancestors\s+'none'/);
});
