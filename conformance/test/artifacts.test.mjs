import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(await readFile(path.join(root, 'artifacts.json'), 'utf8'));
const baseline = JSON.parse(await readFile(path.join(root, 'conformance/artifact-baseline.json'), 'utf8'));
test('workspace-data skeleton verifies checked-in normative artifacts and vectors', async () => {
  assert(manifest.artifacts.some((entry) => entry.class === 'schema'));
  assert(manifest.artifacts.some((entry) => entry.class === 'vector'));
  for (const entry of manifest.artifacts.filter((item) => item.class !== 'generated-declaration')) {
    const bytes = await readFile(path.join(root, entry.path));
    assert.equal(`sha256:${createHash('sha256').update(bytes).digest('hex')}`, entry.contentDigest, entry.path);
  }
});

test('private runner, oracle, candidate, and corpus match reviewed digest baselines', async () => {
  assert.equal(baseline.schemaVersion, 'private-conformance-artifact-baseline-v0');
  assert.deepEqual(Object.keys(baseline), ['schemaVersion', 'artifacts']);
  for (const [relative, expected] of Object.entries(baseline.artifacts)) {
    const bytes = await readFile(path.join(root, relative));
    assert.equal(`sha256:${createHash('sha256').update(bytes).digest('hex')}`, expected, relative);
  }
});
