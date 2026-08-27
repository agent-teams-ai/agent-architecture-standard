import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { root, walk, readJson } from './files.mjs';
import { assertPortablePackageInventory } from './package-paths.mjs';
import { sha256 } from '../lib/digests.mjs';

const immutableDigests = new Map([
  ['decisions/phase-0-d0-d11-v1.md', 'sha256:ac3bfcc019a80483978f45ec4badc384e38124d601be606ae39566963ba422a6'],
  ['vectors/phase-0-remediation-v1.md', 'sha256:90ac226d64160c05b11eebdd0e20062c5d29e505ab11036df68ca387225b427a']
]);
for (const [relative, expected] of immutableDigests) {
  const actual = sha256(await readFile(path.join(root, relative)));
  if (actual !== expected) throw new Error(`immutable historical artifact digest drift: ${relative}: ${actual}`);
}

const manifest = await readJson('artifacts.json');
const paths = manifest.artifacts.map((entry) => entry.path);
if (new Set(paths).size !== paths.length) throw new Error('artifacts.json contains duplicate paths');
if (paths.includes('artifacts.json') || paths.some((relative) => relative.endsWith('.tgz'))) throw new Error('manifest must not contain its own or a tarball digest');
assertPortablePackageInventory(paths, 'manifest');
for (const relative of paths) {
  const bytes = await readFile(path.join(root, relative));
  if (bytes.includes(Buffer.from('\r\n')) || bytes.includes(Buffer.from('\r'))) throw new Error(`non-LF line ending: ${relative}`);
}
const schemas = (await walk('schemas')).filter((item) => item.endsWith('.schema.json'));
const schemaEntries = manifest.artifacts.filter((entry) => entry.class === 'schema');
if (schemas.length !== schemaEntries.length || schemas.some((item) => schemaEntries.filter((entry) => entry.path === item).length !== 1)) throw new Error('every private provisional schema must be indexed exactly once');
const registryFiles = (await walk('registries')).filter((item) => item.endsWith('.json'));
const registryEntries = manifest.artifacts.filter((entry) => entry.class === 'registry');
if (registryFiles.length !== registryEntries.length || registryFiles.some((item) => registryEntries.filter((entry) => entry.path === item).length !== 1)) throw new Error('every registry must be indexed exactly once');
for (const registryPath of registryFiles) {
  const registry = await readJson(registryPath);
  const ids = new Set(registry.entries.map((entry) => entry.id));
  for (const entry of registry.entries) {
    if (entry.replacement !== undefined && !ids.has(entry.replacement)) throw new Error(`registry replacement is not owned by ${registry.registry}: ${entry.id} -> ${entry.replacement}`);
    for (const vector of entry.vectors) {
      if (!paths.includes(vector)) throw new Error(`registry vector is not manifest-owned: ${registry.registry}/${entry.id} -> ${vector}`);
    }
    if (registry.registry === 'envelope-versions' && (entry.kind !== 'envelope-version' || !Number.isSafeInteger(entry.orderingRank))) throw new Error(`invalid envelope-version registry entry: ${entry.id}`);
  }
}
const generated = (await walk('generated')).filter((item) => item.endsWith('.d.ts'));
const generatedEntries = manifest.artifacts.filter((entry) => entry.class === 'generated-declaration');
if (generated.length !== schemas.length || generated.length !== generatedEntries.length) throw new Error('schema/generated declaration cardinality drift');
for (const schema of schemas) {
  const expected = `generated/${path.basename(schema, '.schema.json')}.d.ts`;
  if (generatedEntries.filter((entry) => entry.path === expected).length !== 1) throw new Error(`missing exactly-once generated declaration: ${expected}`);
}
