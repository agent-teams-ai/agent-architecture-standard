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
  for (const entry of await readdir(path.join(root, 'candidates'))) {
    if (!entry.endsWith('.mjs')) continue;
    const source = await readFile(path.join(root, 'candidates', entry), 'utf8');
    for (const specifier of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) assert.match(specifier[1], /^node:/, entry);
    for (const specifier of source.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) assert.match(specifier[1], /^node:/, entry);
  }
});
