import Ajv2020 from 'ajv/dist/2020.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { root, walk, readJson } from './files.mjs';
import { assertAcyclicSchemaGraph } from '../lib/schema-graph.mjs';
import { OfflineSchemaRegistry } from '../lib/schema-registry.mjs';
import { assertPortablePackageInventory } from './package-paths.mjs';
import { assertRegistryInvariants, assertRegistryVectorInvariants, indexRegistryVectorCases } from '../lib/registry-validation.mjs';

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
const schemaByName = new Map(schemaPaths.map((relative, index) => [path.basename(relative), schemas[index]]));
const commonDefinitions = schemaByName.get('common.schema.json').$defs;
const registryValidator = ajv.getSchema('https://schemas.aas.invalid/private/v0/registry.schema.json');
const registryVectorPaths = new Set();
for (const relative of (await walk('registries')).filter((item) => item.endsWith('.json'))) {
  const data = await readJson(relative);
  if (!registryValidator(data)) throw new Error(`${relative}: ${ajv.errorsText(registryValidator.errors)}`);
  assertRegistryInvariants(data, relative);
  const entryIds = data.entries.map((entry) => entry.id);
  if (new Set(entryIds).size !== entryIds.length) throw new Error(`${relative}: duplicate registry identifier`);
  if (data.status !== 'provisional' || data.entries.some((entry) => entry.status !== 'provisional')) throw new Error(`${relative}: every Phase 1 identifier must be provisional`);
  for (const entry of data.entries) for (const vector of entry.vectors) registryVectorPaths.add(vector);
  if (data.registry === 'envelope-versions') {
    const ranks = data.entries.map((entry) => entry.orderingRank);
    if (ranks.some((rank) => !Number.isSafeInteger(rank)) || new Set(ranks).size !== ranks.length) throw new Error(`${relative}: envelope ordering ranks must be unique safe integers`);
  }
}
const envelopeRegistry = await readJson('registries/envelope-versions.json');
const resolutionRegistry = await readJson('registries/resolutions.json');
const actionRegistry = await readJson('registries/actions.json');
const problemRegistry = await readJson('registries/problems.json');
const profileRegistry = await readJson('registries/profiles.json');
const envelopeValues = envelopeRegistry.entries.map((entry) => entry.id);
const resolutionValues = resolutionRegistry.entries.map((entry) => entry.id);
const envelopeSchema = schemaByName.get('envelope.schema.json');
if (JSON.stringify(commonDefinitions.envelopeVersion.enum) !== JSON.stringify(envelopeValues)) throw new Error('envelope-version schema enum drift from registry');
for (const definition of ['diagnosticHeader', 'resolution']) {
  if (JSON.stringify(envelopeSchema.$defs[definition].properties.resolution.enum) !== JSON.stringify(resolutionValues)) throw new Error(`${definition} resolution enum drift from registry`);
}
const registryValues = schemaByName.get('registry-values.schema.json').$defs;
if (JSON.stringify(registryValues.actionId.enum) !== JSON.stringify(actionRegistry.entries.map(({ id }) => id))) throw new Error('generated action wire values drift from actions registry');
if (JSON.stringify(registryValues.problemCode.enum) !== JSON.stringify(problemRegistry.entries.map(({ id }) => id))) throw new Error('generated problem wire values drift from problems registry');
const generatedProfiles = registryValues.canonicalizationProfile.oneOf.map((branch) => ({ id: branch.properties.id.const, version: branch.properties.version.const }));
const ownedProfiles = profileRegistry.entries.map(({ id }) => ({ id, version: id.slice(id.lastIndexOf('@') + 1) }));
if (JSON.stringify(generatedProfiles) !== JSON.stringify(ownedProfiles)) throw new Error('generated canonicalization profile values drift from profiles registry');
const matrix = await readJson('version-matrix.json');
const axes = new Map([
  ['schemaBundle', 'schemaBundleVersion'], ['registryEdition', 'registryEdition'],
  ['vectorSuite', 'vectorSuiteVersion'], ['conformanceSuite', 'conformanceSuiteVersion']
]);
if (JSON.stringify(matrix.supported.envelopeVersions) !== JSON.stringify(envelopeValues)) throw new Error('version matrix envelope versions drift from registry');
for (const [matrixKey, definition] of axes) if (!commonDefinitions[definition].enum.includes(matrix.supported[matrixKey])) throw new Error(`version matrix ${matrixKey} is outside its axis-specific schema registry`);
const manifestValidator = ajv.getSchema('https://schemas.aas.invalid/private/v0/artifact-manifest.schema.json');
const manifest = await readJson('artifacts.json');
if (!manifestValidator(manifest)) throw new Error(`artifacts.json: ${ajv.errorsText(manifestValidator.errors)}`);
assertPortablePackageInventory(manifest.artifacts.map((entry) => entry.path), 'manifest');
const registryCaseDocuments = new Map();
for (const entry of manifest.artifacts.filter((item) => item.class === 'vector' && item.path.endsWith('.json'))) {
  try { registryCaseDocuments.set(entry.path, await readJson(entry.path)); } catch { /* Invalid JSON vectors cannot index admission cases. */ }
}
const registryCaseIndex = indexRegistryVectorCases(registryCaseDocuments);
for (const relative of (await walk('registries')).filter((item) => item.endsWith('.json'))) assertRegistryVectorInvariants(await readJson(relative), manifest, registryCaseIndex);
const manifestPaths = new Set(manifest.artifacts.map((entry) => entry.path));
for (const vector of registryVectorPaths) if (!manifestPaths.has(vector)) throw new Error(`registry vector is not manifest-owned: ${vector}`);
for (const entry of manifest.artifacts) {
  const bytes = await readFile(path.join(root, entry.path));
  if (bytes.byteLength !== entry.byteLength) throw new Error(`byte length drift: ${entry.path}`);
  const { sha256 } = await import('../lib/digests.mjs');
  if (sha256(bytes) !== entry.contentDigest) throw new Error(`digest drift: ${entry.path}`);
}
