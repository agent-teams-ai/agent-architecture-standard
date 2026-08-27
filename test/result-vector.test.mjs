import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { assertInvocationInvariants, assertRequestResultInvariants, assertResultInvariants, canonicalRequestExtensionBytes, canonicalRequestWireBytes, canonicalResultOutputBytes, computeRequestAasIdentity, computeResultAasIdentity, requestIdentityProjection } from '../lib/result-validation.mjs';
import { parseStrictJson } from '../lib/strict-json.mjs';

const canonicalize = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
};
const u32be = (value) => { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(value); return bytes; };
const u64be = (value) => { const bytes = Buffer.alloc(8); bytes.writeBigUInt64BE(BigInt(value)); return bytes; };
const updateTotalWork = (value) => {
  value.realizedCounters.totalWork = ['entries', 'logicalBytes', 'readBytes', 'overlayOperations', 'targets', 'evidenceReferences', 'extensionBytes', 'diagnostics']
    .reduce((sum, counter) => sum + value.realizedCounters[counter], 0);
};

test('request self-identity vector includes every substantive request field', async () => {
  const fixtures = parseStrictJson(await readFile(new URL('../vectors/schema/definition-fixtures.json', import.meta.url)));
  const request = fixtures['request-positive'];
  const payload = Buffer.from(canonicalize(requestIdentityProjection(request)));
  assert.equal(payload.byteLength, 2393);
  assert.equal(`sha256:${createHash('sha256').update(payload).digest('hex')}`, 'sha256:a1359802f414aa332131f68276e42900aea99853efe165d471209ac163f37c8a');
  const magic = Buffer.from('AAS-ID');
  const domain = Buffer.from('aas.request.v0');
  const profile = Buffer.from('agent-architecture-canonical-json-rfc8785@0');
  const frame = Buffer.concat([u32be(magic.length), magic, u32be(domain.length), domain, u32be(profile.length), profile, u64be(payload.length), payload]);
  assert.equal(frame.byteLength, 2476);
  assert.equal(request.aasIdentity, 'aas:v0:sha256:aa39c113c82f3c01be4beeb37cc09de6ff648783c7886a3125a856d41f348042');
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
    ['policy binding', (request) => { request.targets[0].bindingSelection.policyAasIdentity = 'aas:v0:sha256:' + 'a'.repeat(64); }],
    ['binding candidate identity', (request) => { request.targets[0].bindingSelection.candidateBindings[0].aasIdentity = 'aas:v0:sha256:' + 'a'.repeat(64); }],
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
    assert.throws(() => assertResultInvariants(result, request, canonicalRequestWireBytes(request)), /^TypeError: invalid AAS request: request aasIdentity does not match the normative projection$/, name);
  }
});

test('result self-identity vector includes the complete closed result projection', async () => {
  const result = parseStrictJson(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
  assert.doesNotThrow(() => assertResultInvariants(result));
  const expected = result.aasIdentity;
  delete result.aasIdentity;
  for (const resolution of result.resolutions) delete resolution.diagnostic.resultAasIdentity;
  const payload = Buffer.from(canonicalize(result));
  assert.equal(payload.byteLength, 3311);
  assert.equal(`sha256:${createHash('sha256').update(payload).digest('hex')}`, 'sha256:752958bab8e587678df43bf0dd04606aba1cc503c61c8797345cf019a1453517');
  const magic = Buffer.from('AAS-ID');
  const domain = Buffer.from('aas.result.v0');
  const profile = Buffer.from('agent-architecture-canonical-json-rfc8785@0');
  const frame = Buffer.concat([u32be(magic.length), magic, u32be(domain.length), domain, u32be(profile.length), profile, u64be(payload.length), payload]);
  assert.equal(frame.byteLength, 3393);
  assert.equal(expected, `aas:v0:sha256:${createHash('sha256').update(frame).digest('hex')}`);
});

test('result cross-field invariants reject identity, coverage, and count inconsistencies', async () => {
  const original = parseStrictJson(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
  const fixtures = parseStrictJson(await readFile(new URL('../vectors/schema/definition-fixtures.json', import.meta.url)));
  const resign = (value) => {
    updateTotalWork(value);
    value.realizedCounters.outputBytes = canonicalResultOutputBytes(value);
    const identity = computeResultAasIdentity(value);
    value.aasIdentity = identity;
    for (const resolution of value.resolutions) resolution.diagnostic.resultAasIdentity = identity;
  };
  original.diagnostics = [fixtures['diagnostic-positive']];
  original.diagnostics[0].decisionTrace.bindingDecision = structuredClone(original.resolutions[0].diagnostic.decisionTrace);
  original.diagnostics[0].evidenceIds = [];
  original.realizedCounters.diagnostics = 1;
  original.resolutions[0].diagnostic.severityCounts.info = 1;
  original.resolutions[0].diagnostic.highestSeverity = 'info';
  resign(original);
  assert.doesNotThrow(() => assertResultInvariants(original));
  const mutations = [
    ['self identity', (value) => { value.aasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /aasIdentity does not match/ , false],
    ['duplicate coverage stage', (value) => { value.coverage.push({ ...value.coverage[0] }); }, /duplicate coverage stage/, true],
    ['required overlay coverage', (value) => { value.coverage = value.coverage.filter((item) => item.stage !== 'overlay-reevaluation'); }, /overlay reevaluation coverage is missing/, true],
    ['terminal coverage ledger', (value) => { value.coverage[0].unknown = 1; }, /terminal coverage counts/, true],
    ['severity ledger', (value) => { value.resolutions[0].diagnostic.severityCounts.warning = 1; }, /severity counts/, true],
    ['realized diagnostic ledger', (value) => { value.realizedCounters.diagnostics = 0; }, /realized diagnostic count mismatch/, true],
    ['trace/header binding', (value) => { value.diagnostics[0].decisionTrace.bindingDecision.bindingAasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /binding decision mismatch|binding\/policy identity mismatch/, true],
    ['duplicate candidate IDs', (value) => { value.diagnostics[0].decisionTrace.bindingDecision.candidateBindings.push({ ...value.diagnostics[0].decisionTrace.bindingDecision.candidateBindings[0] }); }, /duplicate candidate binding ID/, true],
    ['missing selected candidate', (value) => { value.diagnostics[0].decisionTrace.bindingDecision.selectedBindingId = 'missing'; }, /exactly one candidate/, true],
    ['selected candidate identity', (value) => { value.diagnostics[0].decisionTrace.bindingDecision.candidateBindings[0].aasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /binding\/policy identity mismatch/, true]
  ];
  for (const [name, mutate, invariant, shouldResign] of mutations) {
    const value = structuredClone(original); mutate(value); if (shouldResign) resign(value);
    assert.throws(() => assertResultInvariants(value), invariant, name);
  }
  const badTotalWork = structuredClone(original); badTotalWork.realizedCounters.totalWork += 1;
  badTotalWork.realizedCounters.outputBytes = canonicalResultOutputBytes(badTotalWork);
  badTotalWork.aasIdentity = computeResultAasIdentity(badTotalWork);
  for (const resolution of badTotalWork.resolutions) resolution.diagnostic.resultAasIdentity = badTotalWork.aasIdentity;
  assert.throws(() => assertResultInvariants(badTotalWork), /totalWork does not match/);
});

test('request/result joint validation closes ordered targets and duplicated decisions', async () => {
  const fixtures = parseStrictJson(await readFile(new URL('../vectors/schema/definition-fixtures.json', import.meta.url)));
  const original = parseStrictJson(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
  const requestWire = await readFile(new URL('../vectors/schema/positive/request-wire.json', import.meta.url));
  assert.deepEqual(parseStrictJson(requestWire), fixtures['request-positive']);
  assert.doesNotThrow(() => assertRequestResultInvariants(fixtures['request-positive'], original, requestWire.byteLength));
  const resign = (value) => {
    updateTotalWork(value);
    value.realizedCounters.outputBytes = canonicalResultOutputBytes(value);
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
    ['policy pin', (request, result) => { result.resolutions[0].diagnostic.policyAasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /header binding\/policy decision mismatch/],
    ['binding pin', (request, result) => { result.resolutions[0].diagnostic.bindingAasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /header binding\/policy decision mismatch/],
    ['candidate-set identity', (request, result) => { result.resolutions[0].diagnostic.decisionTrace.candidateBindings[0].aasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /selected binding\/policy identity mismatch|exactly equal/],
    ['stale freshness on decided', (request, result) => { result.resolutions[0].diagnostic.freshness = 'stale'; }, /stale iff stale/],
    ['stale resolution with fresh header', (request, result) => { result.resolutions[0].resolution = 'stale'; result.resolutions[0].diagnostic.resolution = 'stale'; delete result.resolutions[0].verdict; delete result.resolutions[0].diagnostic.verdict; }, /stale iff stale/],
    ['analyzer pin', (request, result) => { result.resolutions[0].diagnostic.analyzerAasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /analyzer identity mismatch/],
    ['overlay pin', (request, result) => { result.resolutions[0].diagnostic.overlayAasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /overlay identity mismatch/],
    ['base snapshot pin', (request) => { request.targets[0].input.baseSnapshotAasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64); }, /baseSnapshot\/request snapshot mismatch/],
    ['coverage completeness', (request, result) => { for (const coverage of [result.coverage[0], result.resolutions[0].coverage[0]]) { coverage.included = 0; coverage.unknown = 1; } result.resolutions[0].diagnostic.coverageSummary = { ...result.resolutions[0].diagnostic.coverageSummary, included: 0, unknown: 1 }; }, /complete evaluation coverage/],
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
    result.realizedCounters.inputBytes = canonicalRequestWireBytes(request);
    result.realizedCounters.extensionBytes = canonicalRequestExtensionBytes(request);
    updateTotalWork(result);
    result.requestAasIdentity = request.aasIdentity;
    for (const resolution of result.resolutions) resolution.diagnostic.requestAasIdentity = request.aasIdentity;
    resign(result);
    assert.throws(() => assertResultInvariants(result, request, canonicalRequestWireBytes(request)), invariant, name);
  }
});

test('realized byte counters are derived exactly and request extension demand is bounded', async () => {
  const fixtures = parseStrictJson(await readFile(new URL('../vectors/schema/definition-fixtures.json', import.meta.url)));
  const request = fixtures['request-positive'];
  const result = parseStrictJson(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
  const rawInputBytes = (await readFile(new URL('../vectors/schema/positive/request-wire.json', import.meta.url))).byteLength;
  for (const seed of [0, 9, Number.MAX_SAFE_INTEGER]) {
    const seeded = structuredClone(result);
    seeded.realizedCounters.outputBytes = seed;
    assert.equal(canonicalResultOutputBytes(seeded), result.realizedCounters.outputBytes, `fixed point from seed ${seed}`);
  }
  for (const counter of ['inputBytes', 'extensionBytes']) {
    const bad = structuredClone(result); bad.realizedCounters[counter] += 1;
    updateTotalWork(bad);
    bad.realizedCounters.outputBytes = canonicalResultOutputBytes(bad);
    const id = computeResultAasIdentity(bad); bad.aasIdentity = id; bad.resolutions[0].diagnostic.resultAasIdentity = id;
    assert.throws(() => assertResultInvariants(bad, request, rawInputBytes), new RegExp(`realized ${counter} does not match`));
  }
  const badOutput = structuredClone(result); badOutput.realizedCounters.outputBytes += 1;
  const outputId = computeResultAasIdentity(badOutput); badOutput.aasIdentity = outputId; badOutput.resolutions[0].diagnostic.resultAasIdentity = outputId;
  assert.throws(() => assertResultInvariants(badOutput), /outputBytes does not match/);
  const oversized = structuredClone(request);
  oversized.extensions = Object.fromEntries(Array.from({ length: 64 }, (_, index) => [`com.example.request-${index}`, true]));
  oversized.criticalExtensions = Object.fromEntries(Array.from({ length: 64 }, (_, index) => [`com.example.critical-${index}`, true]));
  oversized.targets[0].extensions = { 'com.example.target-129': true };
  oversized.budgets.maxInputBytes = 1_000_000;
  oversized.budgets.maxExtensionBytes = 1_000_000;
  oversized.aasIdentity = computeRequestAasIdentity(oversized);
  assert.throws(() => assertRequestResultInvariants(oversized, result, canonicalRequestWireBytes(oversized)), /disposition demand exceeds 128/);
});

test('raw request accounting rejects missing length and 8KB whitespace amplification before evaluation', async () => {
  const wire = await readFile(new URL('../vectors/schema/positive/request-wire.json', import.meta.url));
  const request = parseStrictJson(wire);
  const result = parseStrictJson(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
  assert.throws(() => assertRequestResultInvariants(request, result), /exact received request byte length is required/);
  const amplifiedWire = Buffer.concat([Buffer.alloc(8192, 0x20), wire]);
  assert.deepEqual(parseStrictJson(amplifiedWire), request);
  assert.throws(() => assertRequestResultInvariants(request, result, amplifiedWire.byteLength), /exact received request bytes exceed maxInputBytes/);
});

test('two-target decided plus indeterminate evidence has exact per-target and global coverage', async () => {
  const requestWire = await readFile(new URL('../vectors/schema/positive/mixed-request.json', import.meta.url));
  const request = parseStrictJson(requestWire);
  const result = parseStrictJson(await readFile(new URL('../vectors/schema/positive/mixed-result.json', import.meta.url)));
  assert.doesNotThrow(() => assertResultInvariants(result, request, requestWire.byteLength));
  assert.deepEqual(result.resolutions.map(({ resolution }) => resolution), ['decided', 'indeterminate']);
  assert.equal(result.coverage[0].denominator, 2);
  assert.equal(result.coverage[0].included, 1);
  assert.equal(result.coverage[0].unknown, 1);
  assert.notEqual(request.targets[0].bindingSelection.bindingAasIdentity, request.targets[1].bindingSelection.bindingAasIdentity);
});

test('binding-missing is represented per target without an invented policy or binding', async () => {
  const request = parseStrictJson(await readFile(new URL('../vectors/schema/positive/request-wire.json', import.meta.url)));
  const result = parseStrictJson(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
  request.targets[0].bindingSelection = { state: 'absent', reason: 'binding-missing', candidateBindings: [] };
  request.aasIdentity = computeRequestAasIdentity(request);
  const resolution = result.resolutions[0];
  resolution.resolution = 'needs-input'; resolution.reason = 'binding-missing'; delete resolution.verdict;
  resolution.diagnostic.resolution = 'needs-input'; delete resolution.diagnostic.verdict;
  resolution.diagnostic.bindingState = 'absent'; delete resolution.diagnostic.mode;
  delete resolution.diagnostic.bindingAasIdentity; delete resolution.diagnostic.policyAasIdentity;
  resolution.diagnostic.decisionTrace = structuredClone(request.targets[0].bindingSelection);
  result.requestAasIdentity = request.aasIdentity; resolution.diagnostic.requestAasIdentity = request.aasIdentity;
  result.realizedCounters.inputBytes = canonicalRequestWireBytes(request); updateTotalWork(result);
  result.realizedCounters.outputBytes = canonicalResultOutputBytes(result);
  result.aasIdentity = computeResultAasIdentity(result); resolution.diagnostic.resultAasIdentity = result.aasIdentity;
  assert.doesNotThrow(() => assertResultInvariants(result, request, canonicalRequestWireBytes(request)));
});

test('cross-document invocation closes accounting identity, candidate provenance, and minimum ceilings', async () => {
  const fixtures = parseStrictJson(await readFile(new URL('../vectors/schema/definition-fixtures.json', import.meta.url)));
  const request = structuredClone(fixtures['request-positive']);
  const result = parseStrictJson(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
  request.targets[0].input.limits = structuredClone(request.budgets);
  request.aasIdentity = computeRequestAasIdentity(request);
  const rawInputBytes = canonicalRequestWireBytes(request);
  result.requestAasIdentity = request.aasIdentity;
  result.resolutions[0].diagnostic.requestAasIdentity = request.aasIdentity;
  result.realizedCounters.inputBytes = rawInputBytes; updateTotalWork(result);
  result.realizedCounters.outputBytes = canonicalResultOutputBytes(result);
  result.aasIdentity = computeResultAasIdentity(result); result.resolutions[0].diagnostic.resultAasIdentity = result.aasIdentity;
  const binding = structuredClone(fixtures['binding-required-positive']);
  binding.aasIdentity = request.targets[0].bindingSelection.bindingAasIdentity;
  binding.policyAasIdentity = request.targets[0].bindingSelection.policyAasIdentity;
  binding.budgets = structuredClone(request.budgets);
  const analysisKey = structuredClone(fixtures['analysis-key-positive']);
  analysisKey.aasIdentity = result.analysisKeyAasIdentity;
  analysisKey.budgets = structuredClone(request.budgets);
  const invocation = { request, result, analysisKey, bindings: [binding], applicableBindingsByTarget: { 'target-1': [binding] } };
  const validated = assertInvocationInvariants(invocation, rawInputBytes);
  assert.equal(validated.effectiveBudgets.maxReadBytes, request.budgets.maxReadBytes);

  const substituted = structuredClone(invocation);
  substituted.analysisKey.accountingProfile.aasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64);
  assert.throws(() => assertInvocationInvariants(substituted, rawInputBytes), /accounting profile substitution/);

  const wrongCandidates = structuredClone(invocation);
  wrongCandidates.applicableBindingsByTarget['target-1'] = [];
  assert.throws(() => assertInvocationInvariants(wrongCandidates, rawInputBytes), /exact ordered applicable-set bijection/);

  const omittedCeiling = structuredClone(invocation);
  delete omittedCeiling.analysisKey.budgets.maxReadBytes;
  assert.throws(() => assertInvocationInvariants(omittedCeiling, rawInputBytes), /exact closed budget field set/);

  const tighter = structuredClone(invocation);
  tighter.bindings[0].budgets.maxReadBytes = 1;
  tighter.applicableBindingsByTarget['target-1'][0] = tighter.bindings[0];
  tighter.result.realizedCounters.readBytes = 2; updateTotalWork(tighter.result);
  tighter.result.realizedCounters.outputBytes = canonicalResultOutputBytes(tighter.result);
  tighter.result.aasIdentity = computeResultAasIdentity(tighter.result);
  tighter.result.resolutions[0].diagnostic.resultAasIdentity = tighter.result.aasIdentity;
  assert.throws(() => assertInvocationInvariants(tighter, rawInputBytes), /componentwise-minimum effective maxReadBytes/);
});
