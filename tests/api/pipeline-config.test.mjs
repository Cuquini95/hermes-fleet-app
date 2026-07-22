import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pipelineSource = fs.readFileSync(path.join(repoRoot, 'test-pipeline.mjs'), 'utf8');

test('live pipeline Storage credentials are supplied explicitly through the environment', () => {
  assert.match(pipelineSource, /process\.env\.HERMES_PIPELINE_SUPABASE_URL/);
  assert.match(pipelineSource, /process\.env\.HERMES_PIPELINE_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(pipelineSource, /const SUPABASE_URL\s*=\s*['"]/);
  assert.doesNotMatch(pipelineSource, /const SUPABASE_ANON_KEY\s*=\s*\n?\s*['"]/);
  assert.match(pipelineSource, /refusing to run live Storage tests/);
});
