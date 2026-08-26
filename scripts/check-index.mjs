import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { root, walk, readJson } from './files.mjs';
import { assertPortablePackageInventory } from './package-paths.mjs';

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
const generated = (await walk('generated')).filter((item) => item.endsWith('.d.ts'));
const generatedEntries = manifest.artifacts.filter((entry) => entry.class === 'generated-declaration');
if (generated.length !== schemas.length || generated.length !== generatedEntries.length) throw new Error('schema/generated declaration cardinality drift');
for (const schema of schemas) {
  const expected = `generated/${path.basename(schema, '.schema.json')}.d.ts`;
  if (generatedEntries.filter((entry) => entry.path === expected).length !== 1) throw new Error(`missing exactly-once generated declaration: ${expected}`);
}
