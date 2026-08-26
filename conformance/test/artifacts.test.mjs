import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../..');
const manifest = JSON.parse(await readFile(path.join(root, 'artifacts.json'), 'utf8'));
test('independent skeleton consumes only normative artifacts and vectors', async () => {
  assert(manifest.artifacts.some((entry) => entry.class === 'schema'));
  assert(manifest.artifacts.some((entry) => entry.class === 'vector'));
  for (const entry of manifest.artifacts.filter((item) => item.class !== 'generated-declaration')) {
    const bytes = await readFile(path.join(root, entry.path));
    assert.equal(`sha256:${createHash('sha256').update(bytes).digest('hex')}`, entry.contentDigest, entry.path);
  }
});
