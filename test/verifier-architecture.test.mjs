import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as facade from '../lib/result-validation.mjs';
import * as identities from '../lib/identity-validation.mjs';
import { createInvocationKernel as createPrivateKernel } from '../lib/invocation-kernel.mjs';
import { copyWireBytes, parseAdmittedSchemaBytes } from '../lib/schema-admission-core.mjs';
import { computeProfileAasIdentity } from '../lib/identity-framing.mjs';
import { assertProfileSourceClosure, createProfileSourceBoundary } from '../scripts/profile-source-closure.mjs';

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

test('all 26 facade exports retain base reflection, constants, and signatures', () => {
  const reflection = [
    ['RESOURCE_ACCOUNTING_PROFILE_AAS_IDENTITY', 'string', undefined, 78, false],
    ['assertRequestInvariants', 'function', 'assertRequestInvariants', 2, true],
    ['assertRequestResultInvariants', 'function', 'assertRequestResultInvariants', 3, true],
    ['assertResultInvariants', 'function', 'assertResultInvariants', 3, true],
    ['canonicalRequestExtensionBytes', 'function', 'canonicalRequestExtensionBytes', 1, false],
    ['canonicalRequestWireBytes', 'function', 'canonicalRequestWireBytes', 1, false],
    ['canonicalResultOutputBytes', 'function', 'canonicalResultOutputBytes', 1, false],
    ['computeAnalysisKeyAasIdentity', 'function', 'computeAnalysisKeyAasIdentity', 1, false],
    ['computeAnalyzerAasIdentity', 'function', 'computeAnalyzerAasIdentity', 1, false],
    ['computeBindingAasIdentity', 'function', 'computeBindingAasIdentity', 1, false],
    ['computeBindingSetAasIdentity', 'function', 'computeBindingSetAasIdentity', 1, false],
    ['computeEffectivePolicyAasIdentity', 'function', 'computeEffectivePolicyAasIdentity', 1, false],
    ['computeExceptionAasIdentity', 'function', 'computeExceptionAasIdentity', 1, true],
    ['computeOverlayAasIdentity', 'function', 'computeOverlayAasIdentity', 1, false],
    ['computeProfileAasIdentity', 'function', 'computeProfileAasIdentity', 1, false],
    ['computePromotionAasIdentity', 'function', 'computePromotionAasIdentity', 1, false],
    ['computeRequestAasIdentity', 'function', 'computeRequestAasIdentity', 1, true],
    ['computeResultAasIdentity', 'function', 'computeResultAasIdentity', 1, true],
    ['computeTargetSelectionAasIdentity', 'function', 'computeTargetSelectionAasIdentity', 1, false],
    ['createInvocationKernel', 'function', 'createInvocationKernel', 0, true],
    ['deriveBindingSelection', 'function', 'deriveBindingSelection', 2, true],
    ['deriveEffectiveBudgets', 'function', 'deriveEffectiveBudgets', 1, true],
    ['exceptionIdentityProjection', 'function', 'exceptionIdentityProjection', 1, true],
    ['requestIdentityProjection', 'function', 'requestIdentityProjection', 1, true],
    ['resultIdentityProjection', 'function', 'resultIdentityProjection', 1, true],
    ['terminalFields', 'object', undefined, 7, false],
  ];
  assert.equal(reflection.length, 26);
  for (const [exportName, type, name, length, ownsPrototype] of reflection) {
    const value = facade[exportName];
    assert.equal(typeof value, type, `${exportName} typeof`);
    assert.equal(value.name, name, `${exportName} name`);
    assert.equal(value.length, length, `${exportName} length`);
    assert.equal(Object.hasOwn(value, 'prototype'), ownsPrototype, `${exportName} prototype`);
  }
  assert.deepEqual(facade.terminalFields, ['included', 'policyExcluded', 'unreadable', 'unsupported', 'unstable', 'unknown', 'budgetExhausted']);
  assert.equal(facade.RESOURCE_ACCOUNTING_PROFILE_AAS_IDENTITY, 'aas:v0:sha256:aba07c457684cf217a74215a47e252aab23df9ed9242342a90167d6255365300');
});

test('createInvocationKernel preserves base destructuring and caller observation behavior', () => {
  function baseShape({ operatorAuthority, targetAuthority, providerBudgets, ingressLimits } = {}) {
    return { operatorAuthority, targetAuthority, providerBudgets, ingressLimits };
  }
  const thrown = (call) => { try { call(); } catch (error) { return error; } assert.fail('expected throw'); };
  const expectedNull = thrown(() => baseShape(null));
  const actualNull = thrown(() => facade.createInvocationKernel(null));
  assert.equal(actualNull.constructor, expectedNull.constructor);
  assert.equal(actualNull.message, expectedNull.message);

  const observations = [];
  const inherited = Object.create({ operatorAuthority: undefined, targetAuthority: undefined,
    providerBudgets: undefined, ingressLimits: undefined });
  Object.defineProperty(inherited, 'unrelated', { enumerable: true, get() { observations.push('unrelated'); } });
  const options = new Proxy(inherited, {
    get(target, property, receiver) { observations.push(`get:${String(property)}`); return Reflect.get(target, property, receiver); },
    ownKeys(target) { observations.push('ownKeys'); return Reflect.ownKeys(target); }
  });
  assert.throws(() => facade.createInvocationKernel(options), /providerBudgets/);
  assert.deepEqual(observations, ['get:operatorAuthority', 'get:targetAuthority', 'get:providerBudgets', 'get:ingressLimits']);
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
  const identitySource = await readFile(new URL('../lib/identity-framing.mjs', import.meta.url), 'utf8');
  const modules = await Promise.all(['canonical-json', 'identity-framing', 'identity-validation', 'binding-selection', 'resource-accounting',
    'result-invariants', 'invocation-kernel', 'release-validation'].map((name) => readFile(new URL(`../lib/${name}.mjs`, import.meta.url), 'utf8')));
  const domains = [...identitySource.matchAll(/'aas\.[a-z-]+\.v0'/gu)].map(([value]) => value);
  assert.equal(domains.length, 13);
  assert.equal(new Set(domains).size, 13);
  assert.equal((modules.join('\n').match(/function canonicalJson\(/gu) ?? []).length, 1);
  assert.equal((identitySource.match(/aba07c457684cf217a74215a47e252aab23df9ed9242342a90167d6255365300/gu) ?? []).length, 1);
  const runtimeLiterals = /AAS-ID|agent-architecture-canonical-json-rfc8785@0|'aas\.[a-z-]+\.v0'|aba07c457684cf217a74215a47e252aab23df9ed9242342a90167d6255365300/gu;
  for (const name of ['canonical-json', 'identity-validation', 'binding-selection', 'resource-accounting',
    'result-invariants', 'invocation-kernel', 'release-validation']) {
    const source = await readFile(new URL(`../lib/${name}.mjs`, import.meta.url), 'utf8');
    assert.equal(runtimeLiterals.test(source), false, `${name} duplicates identity framing literal`);
    runtimeLiterals.lastIndex = 0;
  }
});

test('private verifier dependency graph is acyclic and has no facade backedge', async () => {
  const names = ['result-validation', 'canonical-json', 'identity-framing', 'identity-validation', 'binding-selection', 'resource-accounting',
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
  for (const entry of await readdir(new URL('../scripts/', import.meta.url), { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.mjs')) continue;
    const source = await readFile(new URL(`../scripts/${entry.name}`, import.meta.url), 'utf8');
    assert.equal(source.includes('../lib/result-validation.mjs'), false, `${entry.name} imports facade`);
  }
});

test('profile source closure rejects a one-byte immutable Status mutation', async () => {
  const sourceRoot = fileURLToPath(new URL('..', import.meta.url));
  const boundary = createProfileSourceBoundary(sourceRoot);
  await assertProfileSourceClosure(boundary, computeProfileAasIdentity);
  const mutatedBoundary = {
    root: boundary.root,
    read: async (relative) => {
      const bytes = await boundary.read(relative);
      if (relative !== 'spec/security-and-conformance.md') return bytes;
      const mutated = Buffer.from(bytes);
      const status = mutated.indexOf(Buffer.from('Status:'));
      mutated[status + Buffer.byteLength('Status: normative Phase ')] ^= 1;
      return mutated;
    }
  };
  await assert.rejects(() => assertProfileSourceClosure(mutatedBoundary, computeProfileAasIdentity), /exact-byte mismatch|pin mismatch/);
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
  assert.throws(() => createPrivateKernel({}, schemaAdmission), /providerBudgets/);
  assert.deepEqual(reads, { assertSchema: 1, parseSchemaBytes: 1 });
});
