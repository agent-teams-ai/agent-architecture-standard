import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

test('private slice does not import repository, generated, reference, or Foundation implementations', async () => {
  const files = [];
  for (const directory of ['private', 'candidates']) {
    for (const entry of await readdir(path.join(root, directory))) {
      if (entry.endsWith('.mjs')) files.push(path.join(root, directory, entry));
    }
  }
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /(?:from\s*|import\s*\()['"](?:\.\.\/)+(?:lib|generated|reference|foundation)(?:\/|['"])/i, file);
  }
  const good = await readFile(path.join(root, 'candidates/good-strict-json.mjs'), 'utf8');
  for (const specifier of good.matchAll(/from\s+['"]([^'"]+)['"]/g)) assert.match(specifier[1], /^node:/);
});
