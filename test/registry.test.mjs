import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DiagnosticCode } from '../lib/diagnostics.mjs';
import { OfflineSchemaRegistry } from '../lib/schema-registry.mjs';
import { assertAcyclicSchemaGraph } from '../lib/schema-graph.mjs';
import { parseStrictJson } from '../lib/strict-json.mjs';
import { assertRegistryInvariants, assertRegistryVectorInvariants } from '../lib/registry-validation.mjs';

const schema = (name, refs = []) => ({ $id: `https://schemas.aas.invalid/private/v0/${name}.schema.json`, $defs: Object.fromEntries(refs.map((ref, index) => [`r${index}`, { $ref: `${ref}.schema.json` }])) });
test('offline registry rejects duplicate and unknown IDs with stable codes', () => {
  const registry = new OfflineSchemaRegistry();
  registry.add(schema('one'));
  assert.throws(() => registry.add(schema('one')), (error) => error.code === 'aas.schema.duplicate-id');
  assert.throws(() => registry.get('https://schemas.aas.invalid/private/v0/missing.schema.json'), (error) => error.code === 'aas.schema.unknown-id');
});
test('exact catalog rejects ID aliases and case variants', () => {
  const exact = 'https://schemas.aas.invalid/private/v0/one.schema.json';
  const registry = new OfflineSchemaRegistry([exact]);
  registry.add({ $id: exact });
  assert.throws(() => new OfflineSchemaRegistry([exact]).add({ $id: 'https://schemas.aas.invalid/private/v0/ONE.schema.json' }), (error) => error.code === 'aas.schema.alias-id');
  assert.throws(() => assertAcyclicSchemaGraph([{ $id: exact, $ref: './one.schema.json' }]), (error) => error.code === 'aas.schema.alias-id');
  for (const alias of [
    'HTTPS://schemas.aas.invalid/private/v0/one.schema.json',
    'https://schemas.aas.invalid:443/private/v0/one.schema.json',
    'https://user@schemas.aas.invalid/private/v0/one.schema.json',
    'https://schemas.aas.invalid/private/v0/One.schema.json'
  ]) assert.throws(() => assertAcyclicSchemaGraph([{ $id: alias }]), (error) => error.code === 'aas.schema.alias-id', alias);
});

test('catalog ingestion enforces schema-count and nesting-depth limits', () => {
  assert.throws(() => assertAcyclicSchemaGraph([schema('a'), schema('b')], { maxSchemas: 1, maxDepth: 8 }), (error) => error.code === 'aas.json.input-too-large');
  assert.throws(() => assertAcyclicSchemaGraph([{ ...schema('a'), deep: { one: { two: true } } }], { maxSchemas: 1, maxDepth: 1 }), (error) => error.code === 'aas.json.depth-exceeded');
});
test('closed catalog rejects embedded aliases and non-static reference keywords', () => {
  const id = 'https://schemas.aas.invalid/private/v0/one.schema.json';
  for (const malicious of [
    { $defs: { nested: { $id: 'alias.json' } } },
    { $defs: { nested: { $anchor: 'alias' } } },
    { $defs: { nested: { $dynamicAnchor: 'alias' } } },
    { $defs: { nested: { $recursiveAnchor: true } } }
  ]) assert.throws(() => new OfflineSchemaRegistry([id]).add({ $id: id, ...malicious }), (error) => error.code === 'aas.schema.alias-id');
  for (const malicious of [{ $dynamicRef: '#alias' }, { $recursiveRef: '#' }, { $defs: { nested: { $schema: 'https://example.invalid/meta' } } }, { $vocabulary: { 'https://example.invalid/vocab': true } }]) {
    assert.throws(() => new OfflineSchemaRegistry([id]).add({ $id: id, ...malicious }), (error) => error.code === 'aas.schema.network-ref');
  }
});
test('offline reference graph rejects cycles, unknowns, and network references', () => {
  assert.throws(() => assertAcyclicSchemaGraph([schema('a', ['b']), schema('b', ['a'])]), (error) => error.code === 'aas.schema.ref-cycle');
  assert.throws(() => assertAcyclicSchemaGraph([schema('a', ['missing'])]), (error) => error.code === 'aas.schema.unknown-id');
  assert.throws(() => assertAcyclicSchemaGraph([{ $id: 'https://schemas.aas.invalid/private/v0/a.schema.json', $ref: 'https://example.invalid/x' }]), (error) => error.code === 'aas.schema.network-ref');
  for (const $ref of ['//example.invalid/x', '/etc/passwd', 'C:\\secret.schema.json', '../escape.schema.json', './alias.schema.json', 'file%3Asecret.schema.json']) {
    assert.throws(() => assertAcyclicSchemaGraph([{ $id: 'https://schemas.aas.invalid/private/v0/a.schema.json', $ref }]), (error) => ['aas.schema.network-ref', 'aas.schema.alias-id'].includes(error.code));
  }
});
test('runtime diagnostic projection exactly matches the normative registry', async () => {
  const registry = parseStrictJson(await readFile(new URL('../registries/diagnostics.json', import.meta.url)));
  assert.deepEqual(Object.values(DiagnosticCode).sort(), registry.entries.map((entry) => entry.id).sort());
});
test('registry closure validates file identity, replacements, and vector artifact polarity', () => {
  const base = {
    registry: 'actions', edition: '1', previousEdition: null, status: 'provisional', changes: ['test'],
    entries: [{ id: 'old', kind: 'action', status: 'deprecated', vectors: ['vectors/schema/positive/result.json', 'vectors/schema/negative/overlay-unknown-field.json'], replacement: 'new' }, { id: 'new', kind: 'action', status: 'active', vectors: ['vectors/schema/corpus.json'] }]
  };
  const manifest = { artifacts: [
    { path: 'vectors/schema/positive/result.json', class: 'vector' },
    { path: 'vectors/schema/negative/overlay-unknown-field.json', class: 'vector' },
    { path: 'vectors/schema/corpus.json', class: 'vector' }
  ] };
  assert.doesNotThrow(() => assertRegistryInvariants(base, 'registries/actions.json'));
  assert.doesNotThrow(() => assertRegistryVectorInvariants(base, manifest));
  for (const mutate of [
    (value) => { value.registry = 'problems'; },
    (value) => { value.entries[0].replacement = 'old'; },
    (value) => { value.entries[0].replacement = 'missing'; },
    (value) => { value.entries[1].kind = 'problem'; }
  ]) { const value = structuredClone(base); mutate(value); assert.throws(() => assertRegistryInvariants(value, 'registries/actions.json'), /invalid AAS registry/); }
  const badManifest = structuredClone(manifest); badManifest.artifacts[0].class = 'normative-prose';
  assert.throws(() => assertRegistryVectorInvariants(base, badManifest), /manifest-owned validation artifact/);
  const matrixRegistry = structuredClone(base); matrixRegistry.entries = [{ ...matrixRegistry.entries[0], status: 'provisional', vectors: ['version-matrix.json'] }];
  assert.doesNotThrow(() => assertRegistryVectorInvariants(matrixRegistry, { artifacts: [{ path: 'version-matrix.json', class: 'version-matrix' }] }));
});
test('packaged catalog case records drive all declared adversarial dispositions', async () => {
  const corpus = parseStrictJson(await readFile(new URL('../vectors/schema/catalog-corpus.json', import.meta.url)));
  const seen = new Set();
  for (const item of corpus.cases) {
    assert(!seen.has(item.caseId), `duplicate case ID: ${item.caseId}`); seen.add(item.caseId);
    assert.equal(item.expected.version, corpus.schemaVersion);
    assert.equal(typeof item.requirement, 'string');
    assert.equal(typeof item.rationale, 'string');
    assert(Number.isSafeInteger(item.limits.maxSchemas) && Number.isSafeInteger(item.limits.maxDepth));
    assert.throws(() => assertAcyclicSchemaGraph(item.input.schemas, item.limits), (error) => error.code === item.expected.diagnostic, item.caseId);
  }
});
