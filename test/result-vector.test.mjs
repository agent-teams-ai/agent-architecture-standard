import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { assertRequestResultInvariants, assertResultInvariants, computeRequestAasIdentity, computeResultAasIdentity, requestIdentityProjection } from '../lib/result-validation.mjs';
import { parseStrictJson } from '../lib/strict-json.mjs';

const canonicalize = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
};
const u32be = (value) => { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(value); return bytes; };
const u64be = (value) => { const bytes = Buffer.alloc(8); bytes.writeBigUInt64BE(BigInt(value)); return bytes; };

test('request self-identity vector includes every substantive request field', async () => {
  const fixtures = parseStrictJson(await readFile(new URL('../vectors/schema/definition-fixtures.json', import.meta.url)));
  const request = fixtures['request-positive'];
  const payload = Buffer.from(canonicalize(requestIdentityProjection(request)));
  assert.equal(payload.byteLength, 1905);
  assert.equal(`sha256:${createHash('sha256').update(payload).digest('hex')}`, 'sha256:f3da1a4ca03ccf4b8cd17cafbe3abc1fcb7baed940e212ce205e218e88777509');
  const magic = Buffer.from('AAS-ID');
  const domain = Buffer.from('aas.request.v0');
  const profile = Buffer.from('agent-architecture-canonical-json-rfc8785@0');
  const frame = Buffer.concat([u32be(magic.length), magic, u32be(domain.length), domain, u32be(profile.length), profile, u64be(payload.length), payload]);
  assert.equal(frame.byteLength, 1988);
  assert.equal(request.aasIdentity, 'aas:v0:sha256:ad9628279ba001533d359523010509384ea9b1bc7688a484159f0eb12e80f2e7');
  assert.equal(computeRequestAasIdentity(request), request.aasIdentity);
  assert.equal(`aas:v0:sha256:${createHash('sha256').update(frame).digest('hex')}`, request.aasIdentity);
});

test('joint validation rejects stale request identities before reconciliation', async () => {
  const fixtures = parseStrictJson(await readFile(new URL('../vectors/schema/definition-fixtures.json', import.meta.url)));
  const originalRequest = fixtures['request-positive'];
  const originalResult = parseStrictJson(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
  const staleMutations = [
    ['budget', (request) => { request.budgets.maxInputBytes += 1; }],
    ['target overlay identity', (request) => { request.targets[0].input.aasIdentity = 'aas:v0:sha256:' + 'a'.repeat(64); }],
    ['target overlay base snapshot', (request) => { request.targets[0].input.baseSnapshotAasIdentity = 'aas:v0:sha256:' + 'a'.repeat(64); }],
    ['operation version', (request) => { request.operation = 'validate-overlay@2'; }],
    ['envelope version', (request) => { request.envelopeVersion = '9.9'; }],
    ['snapshot binding', (request) => { request.snapshotAasIdentity = 'aas:v0:sha256:' + 'a'.repeat(64); }],
    ['policy binding', (request) => { request.policyAasIdentity = 'aas:v0:sha256:' + 'a'.repeat(64); }],
    ['binding binding', (request) => { request.bindingAasIdentity = 'aas:v0:sha256:' + 'a'.repeat(64); }],
    ['profile binding', (request) => { request.profileAasIdentity = 'aas:v0:sha256:' + 'a'.repeat(64); }],
    ['analyzer binding', (request) => { request.analyzerAasIdentity = 'aas:v0:sha256:' + 'a'.repeat(64); }],
    ['accounting profile binding', (request) => { request.accountingProfileAasIdentity = 'aas:v0:sha256:' + 'a'.repeat(64); }],
    ['request extension', (request) => { request.extensions['com.example.added'] = { enabled: true }; }],
    ['critical request extension', (request) => { request.criticalExtensions['com.example.critical'] = true; }],
    ['target extension', (request) => { request.targets[0].extensions['com.example.target'] = true; }],
    ['critical target extension', (request) => { request.targets[0].criticalExtensions['com.example.target-critical'] = true; }]
  ];
  for (const [name, mutate] of staleMutations) {
    const request = structuredClone(originalRequest);
    const result = structuredClone(originalResult);
    mutate(request);
    const resultIdentity = computeResultAasIdentity(result);
    result.aasIdentity = resultIdentity;
    for (const resolution of result.resolutions) resolution.diagnostic.resultAasIdentity = resultIdentity;
    assert.throws(() => assertResultInvariants(result, request), /^TypeError: invalid AAS request: request aasIdentity does not match the normative projection$/, name);
  }
});

test('result self-identity vector includes the complete closed result projection', async () => {
  const result = parseStrictJson(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
  assert.doesNotThrow(() => assertResultInvariants(result));
  const expected = result.aasIdentity;
  delete result.aasIdentity;
  for (const resolution of result.resolutions) delete resolution.diagnostic.resultAasIdentity;
  const payload = Buffer.from(canonicalize(result));
  assert.equal(payload.byteLength, 2449);
  assert.equal(`sha256:${createHash('sha256').update(payload).digest('hex')}`, 'sha256:dd82e78743100960021cb6997b84afba41890f98b392066e7023b943f8fdb21a');
  const magic = Buffer.from('AAS-ID');
  const domain = Buffer.from('aas.result.v0');
  const profile = Buffer.from('agent-architecture-canonical-json-rfc8785@0');
  const frame = Buffer.concat([u32be(magic.length), magic, u32be(domain.length), domain, u32be(profile.length), profile, u64be(payload.length), payload]);
  assert.equal(frame.byteLength, 2531);
  assert.equal(expected, `aas:v0:sha256:${createHash('sha256').update(frame).digest('hex')}`);
});

test('result cross-field invariants reject identity, coverage, and count inconsistencies', async () => {
  const original = parseStrictJson(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
  const resign = (value) => {
    const identity = computeResultAasIdentity(value);
    value.aasIdentity = identity;
    for (const resolution of value.resolutions) resolution.diagnostic.resultAasIdentity = identity;
  };
  const mutations = [
    ['self identity', (value) => { value.aasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /aasIdentity does not match/ , false],
    ['duplicate coverage stage', (value) => { value.coverage.push({ ...value.coverage[0] }); }, /duplicate coverage stage/, true],
    ['required overlay coverage', (value) => { value.coverage = value.coverage.filter((item) => item.stage !== 'overlay-reevaluation'); }, /overlay reevaluation coverage is missing/, true],
    ['terminal coverage ledger', (value) => { value.coverage[0].unknown = 1; }, /terminal coverage counts/, true],
    ['severity ledger', (value) => { value.resolutions[0].diagnostic.severityCounts.info = 1; }, /severity counts/, true],
    ['realized diagnostic ledger', (value) => { value.realizedCounters.diagnostics = 1; }, /realized diagnostic count mismatch/, true]
  ];
  for (const [name, mutate, invariant, shouldResign] of mutations) {
    const value = structuredClone(original); mutate(value); if (shouldResign) resign(value);
    assert.throws(() => assertResultInvariants(value), invariant, name);
  }
});

test('request/result joint validation closes ordered targets and duplicated decisions', async () => {
  const fixtures = parseStrictJson(await readFile(new URL('../vectors/schema/definition-fixtures.json', import.meta.url)));
  const original = parseStrictJson(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
  assert.doesNotThrow(() => assertRequestResultInvariants(fixtures['request-positive'], original));
  const resign = (value) => {
    const identity = computeResultAasIdentity(value);
    value.aasIdentity = identity;
    for (const resolution of value.resolutions) resolution.diagnostic.resultAasIdentity = identity;
  };
  const mutations = [
    ['duplicate request target', (request) => { request.targets.push(structuredClone(request.targets[0])); }, /duplicate request target id/],
    ['target bijection', (request, result) => { result.resolutions[0].targetId = 'other'; result.resolutions[0].diagnostic.targetId = 'other'; }, /ordered request-target bijection/],
    ['header target pin', (request, result) => { result.resolutions[0].diagnostic.targetId = 'other'; }, /resolution\/header target mismatch/],
    ['header resolution pin', (request, result) => { result.resolutions[0].diagnostic.resolution = 'unsupported'; }, /resolution\/header disposition mismatch/],
    ['decided verdict', (request, result) => { delete result.resolutions[0].verdict; }, /decided resolution requires/],
    ['envelope version pin', (request, result) => { result.envelopeVersion = '9.9'; }, /envelope version mismatch/],
    ['snapshot pin', (request, result) => { result.resolutions[0].diagnostic.snapshotAasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /snapshot identity mismatch/],
    ['policy pin', (request, result) => { result.resolutions[0].diagnostic.policyAasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /policy identity mismatch/],
    ['binding pin', (request, result) => { result.resolutions[0].diagnostic.bindingAasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /binding identity mismatch/],
    ['analyzer pin', (request, result) => { result.resolutions[0].diagnostic.analyzerAasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /analyzer identity mismatch/],
    ['overlay pin', (request, result) => { result.resolutions[0].diagnostic.overlayAasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /overlay identity mismatch/],
    ['base snapshot pin', (request) => { request.targets[0].input.baseSnapshotAasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /baseSnapshot\/request snapshot mismatch/],
    ['coverage completeness', (request, result) => { result.coverage[0].included = 0; result.coverage[0].unknown = 1; result.resolutions[0].diagnostic.coverageSummary = { ...result.resolutions[0].diagnostic.coverageSummary, included: 0, unknown: 1 }; }, /complete evaluation coverage/],
    ['budget accounting', (request, result) => { result.realizedCounters.readBytes = request.budgets.maxReadBytes + 1; }, /readBytes exceeds request maxReadBytes/],
    ['invented extension', (request, result) => { result.extensionDispositions.push({ extensionId: 'com.example.invented', location: 'request', disposition: 'ignored', requestBound: true, affectsCoreSemantics: false }); }, /invented or incorrectly scoped/],
    ['missing extension', (request, result) => { result.extensionDispositions = []; }, /exact request\/target\/location\/extension bijection/],
    ['target extension scope', (request, result) => { request.targets[0].extensions['com.example.target'] = true; result.extensionDispositions.push({ extensionId: 'com.example.target', location: 'target', targetId: 'other', disposition: 'preserved', requestBound: true, affectsCoreSemantics: false }); }, /invented or incorrectly scoped/],
    ['critical extension scope', (request, result) => { request.targets[0].criticalExtensions['com.example.critical'] = true; result.extensionDispositions.push({ extensionId: 'com.example.critical', location: 'target', targetId: 'target-1', disposition: 'preserved', requestBound: true, affectsCoreSemantics: false }); }, /critical extension was not understood/]
  ];
  for (const [name, mutate, invariant] of mutations) {
    const request = structuredClone(fixtures['request-positive']);
    const result = structuredClone(original);
    mutate(request, result);
    request.aasIdentity = computeRequestAasIdentity(request);
    result.requestAasIdentity = request.aasIdentity;
    for (const resolution of result.resolutions) resolution.diagnostic.requestAasIdentity = request.aasIdentity;
    resign(result);
    assert.throws(() => assertResultInvariants(result, request), invariant, name);
  }
});
