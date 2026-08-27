import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import * as facade from '../lib/result-validation.mjs';
import * as identities from '../lib/identity-validation.mjs';
import { createInvocationKernel as createPrivateKernel } from '../lib/invocation-kernel.mjs';
import { copyWireBytes, parseAdmittedSchemaBytes } from '../lib/schema-admission-core.mjs';

const expectedExports = [
  'RESOURCE_ACCOUNTING_PROFILE_AAS_IDENTITY', 'assertRequestInvariants', 'assertRequestResultInvariants',
  'assertResultInvariants', 'canonicalRequestExtensionBytes', 'canonicalRequestWireBytes',
  'canonicalResultOutputBytes', 'computeAnalysisKeyAasIdentity', 'computeAnalyzerAasIdentity',
  'computeBindingAasIdentity', 'computeBindingSetAasIdentity', 'computeEffectivePolicyAasIdentity',
  'computeExceptionAasIdentity', 'computeOverlayAasIdentity', 'computeProfileAasIdentity',
  'computePromotionAasIdentity', 'computeRequestAasIdentity', 'computeResultAasIdentity',
  'computeTargetSelectionAasIdentity', 'createInvocationKernel', 'deriveBindingSelection',
  'deriveEffectiveBudgets', 'exceptionIdentityProjection', 'requestIdentityProjection',
  'resultIdentityProjection', 'terminalFields'
];

test('result-validation facade has the fixed 26-name compatibility surface', () => {
  assert.deepEqual(Object.keys(facade).sort(), expectedExports.sort());
});

test('all twelve identity functions retain exact vectors and three projections remove only duplicated identities', async () => {
  const fixtures = JSON.parse(await readFile(new URL('../vectors/schema/definition-fixtures.json', import.meta.url)));
  const result = JSON.parse(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
  const vectors = {
    Binding: [fixtures['binding-required-positive'], 'af7bb4d8e778112f27ed0c14e770c4c120fd42ac3666c6beb70900ef7a089e4b'],
    BindingSet: [fixtures['binding-set-positive'], 'd42e2f7fa8bbad8ee88825ab85d36d0ebb8722e892db4055d4db0a978efa625a'],
    TargetSelection: [fixtures['target-selection-positive'], 'ee558e010574ddc2ea5259579f916667a528988f00e8e196394c9e49edad68fc'],
    Overlay: [fixtures['request-positive'].targets[0].input, '72c3f41243d020e957eadb1195c128e1bf8eef8fdfed467678f99b3c7767fa81'],
    AnalysisKey: [fixtures['analysis-key-positive'], '649c0105d630877bb86c5d00d2e5928203dbe3f6374106c4b8305294afea49cb'],
    Profile: [fixtures['profile-positive'], 'f06069501f33883682f3334b58500f552e8ae189d32aec9560bb76f9cd250264'],
    EffectivePolicy: [fixtures['effective-policy-positive'], '0d8bdfdb5199e18f05a9f93e44dafcfc85aac4e897f939d137014774c387c6ec'],
    Analyzer: [fixtures['analyzer-positive'], 'bb82a1b960d89f8fe716e81ecd0b8708a665f3f95c6b910d87a55d8276b0e12c'],
    Promotion: [fixtures['promotion-positive'], 'b24e982ee183b6500fcc9409c29072c0d367b22aceeb0cc75af6c32c2a4a2649'],
    Exception: [fixtures['exception-positive'], '5cd536b1e65d83259a715ae2ec5f1a4683b11809634b7e581abe5fe9851fab9c'],
    Request: [fixtures['request-positive'], '4e6d0bcf889bbe91fdf61126ea147d3b2b2b3c42289fc45973e13a525720e142'],
    Result: [result, '6ae2c3fcd5e43137440c296f8ef4da7e42b3eabb0543e8a49f7adfb55388a990']
  };
  for (const [name, [value, digest]] of Object.entries(vectors)) {
    assert.equal(identities[`compute${name}AasIdentity`](value), `aas:v0:sha256:${digest}`, name);
  }
  const requestProjection = identities.requestIdentityProjection(fixtures['request-positive']);
  const exceptionProjection = identities.exceptionIdentityProjection(fixtures['exception-positive']);
  const resultProjection = identities.resultIdentityProjection(result);
  assert.equal('aasIdentity' in requestProjection, false);
  assert.equal('aasIdentity' in exceptionProjection, false);
  assert.equal('aasIdentity' in resultProjection, false);
  assert.equal('resultAasIdentity' in resultProjection.resolutions[0].diagnostic, false);
  assert.equal(fixtures['request-positive'].aasIdentity.startsWith('aas:'), true, 'projection does not mutate input');
});

test('identity domains and canonical JSON implementation have one closed source without drift or duplicates', async () => {
  const identitySource = await readFile(new URL('../lib/identity-validation.mjs', import.meta.url), 'utf8');
  const modules = await Promise.all(['canonical-json', 'identity-validation', 'binding-selection', 'resource-accounting',
    'result-invariants', 'invocation-kernel', 'release-validation'].map((name) => readFile(new URL(`../lib/${name}.mjs`, import.meta.url), 'utf8')));
  const domains = [...identitySource.matchAll(/'aas\.[a-z-]+\.v0'/gu)].map(([value]) => value);
  assert.equal(domains.length, 12);
  assert.equal(new Set(domains).size, 12);
  assert.equal((modules.join('\n').match(/function canonicalJson\(/gu) ?? []).length, 1);
  assert.equal((identitySource.match(/aba07c457684cf217a74215a47e252aab23df9ed9242342a90167d6255365300/gu) ?? []).length, 1);
});

test('private verifier dependency graph is acyclic and has no facade backedge', async () => {
  const names = ['result-validation', 'canonical-json', 'identity-validation', 'binding-selection', 'resource-accounting',
    'result-invariants', 'invocation-kernel', 'schema-admission', 'schema-admission-core'];
  const graph = new Map();
  for (const name of names) {
    const source = await readFile(new URL(`../lib/${name}.mjs`, import.meta.url), 'utf8');
    const imports = [...source.matchAll(/from ['"]\.\/([^'"]+)\.mjs['"]/gu)].map((match) => match[1]);
    graph.set(name, imports.filter((dependency) => names.includes(dependency)));
    if (name !== 'result-validation') assert.equal(imports.includes('result-validation'), false, `${name} imports facade`);
  }
  assert.equal(graph.get('invocation-kernel').includes('schema-admission'), false, 'kernel imports concrete adapter');
  const visiting = new Set(), visited = new Set();
  const visit = (name) => {
    assert.equal(visiting.has(name), false, `dependency cycle through ${name}`);
    if (visited.has(name)) return;
    visiting.add(name); for (const dependency of graph.get(name) ?? []) visit(dependency); visiting.delete(name); visited.add(name);
  };
  for (const name of names) visit(name);
});

test('identity and facade imports neither read schemas nor load or compile Ajv', () => {
  const script = `
    import fs from 'node:fs'; import Module, { syncBuiltinESMExports } from 'node:module';
    const read = fs.readFileSync, readdir = fs.readdirSync;
    fs.readFileSync = function (path, ...rest) { if (String(path).includes('/schemas/')) throw new Error('schema read during import'); return read.call(this, path, ...rest); };
    fs.readdirSync = function (path, ...rest) { if (String(path).includes('/schemas/')) throw new Error('schema scan during import'); return readdir.call(this, path, ...rest); }; syncBuiltinESMExports();
    const load = Module._load; Module._load = function (name, ...rest) {
      if (String(name).startsWith('ajv')) throw new Error('Ajv loaded during import'); return load.call(this, name, ...rest);
    };
    await import(${JSON.stringify(new URL('../lib/identity-validation.mjs', import.meta.url).href)});
    await import(${JSON.stringify(new URL('../lib/result-validation.mjs', import.meta.url).href)});
  `;
  const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
});

test('pure schema admission rejects hostile views and delegates synchronously', () => {
  assert.throws(() => copyWireBytes(new Uint8Array(new SharedArrayBuffer(2)), 'shared'), /non-shared ArrayBuffer/);
  assert.throws(() => copyWireBytes(new Proxy(new Uint8Array(2), {}), 'proxy'), /non-shared ArrayBuffer/);
  let admitted = 0;
  const wire = parseAdmittedSchemaBytes(Buffer.from('{"ok":true}'), 'sample', 'sample', { maxBytes: 20, maxDepth: 4 }, (value, definition, label) => {
    admitted += 1; assert.deepEqual([value, definition, label], [{ ok: true }, 'sample', 'sample']);
  });
  assert.equal(admitted, 1); assert.equal(wire.byteLength, 11); assert.deepEqual(wire.parsed, { ok: true });
});

test('kernel captures each injected schema-admission dependency exactly once', () => {
  const reads = { assertSchema: 0, parseSchemaBytes: 0 };
  const schemaAdmission = {};
  for (const name of Object.keys(reads)) Object.defineProperty(schemaAdmission, name, {
    enumerable: true, get() { reads[name] += 1; return () => {}; }
  });
  assert.throws(() => createPrivateKernel({ schemaAdmission }), /providerBudgets/);
  assert.deepEqual(reads, { assertSchema: 1, parseSchemaBytes: 1 });
});
