import Ajv2020 from 'ajv/dist/2020.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { root, walk, readJson } from './files.mjs';
import { assertAcyclicSchemaGraph } from '../lib/schema-graph.mjs';
import { OfflineSchemaRegistry } from '../lib/schema-registry.mjs';

const schemaPaths = (await walk('schemas')).filter((item) => item.endsWith('.schema.json'));
const schemas = await Promise.all(schemaPaths.map(readJson));
const expectedCatalog = new Map(schemaPaths.map((relative) => [relative, `https://schemas.aas.invalid/private/v0/${path.basename(relative)}`]));
const catalog = new OfflineSchemaRegistry(expectedCatalog.values());
const ids = new Set();
for (let index = 0; index < schemas.length; index++) {
  const schema = schemas[index];
  if (ids.has(schema.$id)) throw new Error(`duplicate schema ID: ${schema.$id}`);
  ids.add(schema.$id);
  if (schema.$id !== expectedCatalog.get(schemaPaths[index])) throw new Error(`schema ID/path alias: ${schemaPaths[index]} -> ${schema.$id}`);
  if (schema['x-aas-status'] !== 'private-provisional-unpublished') throw new Error(`schema is not explicitly private provisional: ${schema.$id}`);
  catalog.add(schema);
}
assertAcyclicSchemaGraph(schemas);
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true, validateFormats: false });
ajv.addKeyword({ keyword: 'x-aas-status', schemaType: 'string', valid: true });
for (const schema of schemas) ajv.addSchema(schema);
for (const schema of schemas) ajv.getSchema(schema.$id);
const registryValidator = ajv.getSchema('https://schemas.aas.invalid/private/v0/registry.schema.json');
for (const relative of (await walk('registries')).filter((item) => item.endsWith('.json'))) {
  const data = await readJson(relative);
  if (!registryValidator(data)) throw new Error(`${relative}: ${ajv.errorsText(registryValidator.errors)}`);
  const entryIds = data.entries.map((entry) => entry.id);
  if (new Set(entryIds).size !== entryIds.length) throw new Error(`${relative}: duplicate registry identifier`);
  if (data.status !== 'provisional' || data.entries.some((entry) => entry.status !== 'provisional')) throw new Error(`${relative}: every Phase 1 identifier must be provisional`);
  if (data.registry === 'envelope-versions') {
    const ranks = data.entries.map((entry) => entry.orderingRank);
    if (ranks.some((rank) => !Number.isSafeInteger(rank)) || new Set(ranks).size !== ranks.length) throw new Error(`${relative}: envelope ordering ranks must be unique safe integers`);
  }
}
const manifestValidator = ajv.getSchema('https://schemas.aas.invalid/private/v0/artifact-manifest.schema.json');
const manifest = await readJson('artifacts.json');
if (!manifestValidator(manifest)) throw new Error(`artifacts.json: ${ajv.errorsText(manifestValidator.errors)}`);
for (const entry of manifest.artifacts) {
  const bytes = await readFile(path.join(root, entry.path));
  if (bytes.byteLength !== entry.byteLength) throw new Error(`byte length drift: ${entry.path}`);
  const { sha256 } = await import('../lib/digests.mjs');
  if (sha256(bytes) !== entry.contentDigest) throw new Error(`digest drift: ${entry.path}`);
}
