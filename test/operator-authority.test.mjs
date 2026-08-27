import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  RESOURCE_ACCOUNTING_PROFILE_AAS_IDENTITY, canonicalRequestExtensionBytes, canonicalResultOutputBytes,
  computeAnalyzerAasIdentity, computeBindingAasIdentity, computeBindingSetAasIdentity, computeEffectivePolicyAasIdentity,
  computeExceptionAasIdentity, computeOverlayAasIdentity, computeProfileAasIdentity, computePromotionAasIdentity,
  computeRequestAasIdentity, computeResultAasIdentity, computeTargetSelectionAasIdentity, createInvocationKernel,
  deriveBindingSelection, exceptionIdentityProjection
} from '../lib/result-validation.mjs';

const fixtures = JSON.parse(await readFile(new URL('../vectors/schema/definition-fixtures.json', import.meta.url)));
const accounting = JSON.parse(await readFile(new URL('../profiles/resource-accounting-v0-1.json', import.meta.url)));
const portablePathProfile = JSON.parse(await readFile(new URL('../profiles/portable-path-unicode17-v1.json', import.meta.url)));
const resultFixture = JSON.parse(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
const encode = (value, space) => new TextEncoder().encode(JSON.stringify(value, null, space));
const ref = ({ aasIdentity, id, definitionVersion }) => ({ version: definitionVersion, id, aasIdentity });
const artifact = { aasIdentity: `aas:v0:sha256:${'3'.repeat(64)}`, contentDigest: `sha256:${'4'.repeat(64)}`, byteLength: 1, mediaType: 'application/json' };
const makeProfile = (kind, id, dependencies = []) => {
  const profile = { aasIdentity: '', kind, id, definitionVersion: '1', schemas: [artifact], dependencies,
    limits: structuredClone(accounting.limits), semanticsArtifacts: [artifact], definitionVectorSuites: [artifact] };
  profile.aasIdentity = computeProfileAasIdentity(profile); return profile;
};
const resignResult = (result) => {
  result.realizedCounters.totalWork = ['entries', 'logicalBytes', 'readBytes', 'overlayOperations', 'targets', 'evidenceReferences', 'extensionBytes', 'diagnostics']
    .reduce((sum, counter) => sum + result.realizedCounters[counter], 0);
  result.realizedCounters.outputBytes = canonicalResultOutputBytes(result);
  result.aasIdentity = computeResultAasIdentity(result);
  for (const resolution of result.resolutions) resolution.diagnostic.resultAasIdentity = result.aasIdentity;
};

function makeState({ mode = 'required', rolloutScope = 'all', profileMaxDiagnostics } = {}) {
  const request = structuredClone(fixtures['request-positive']);
  const operation = makeProfile('operation', 'validate-overlay-operation@1');
  const evaluator = makeProfile('evaluator', 'overlay-evaluator@1');
  if (profileMaxDiagnostics !== undefined) {
    operation.limits.maxDiagnostics = profileMaxDiagnostics; operation.aasIdentity = computeProfileAasIdentity(operation);
    evaluator.limits.maxDiagnostics = profileMaxDiagnostics; evaluator.aasIdentity = computeProfileAasIdentity(evaluator);
  }
  const path = structuredClone(portablePathProfile);
  const analyzer = { aasIdentity: '', implementationArtifacts: [artifact], configuration: [], profiles: [ref(evaluator)] };
  analyzer.aasIdentity = computeAnalyzerAasIdentity(analyzer);
  const binding = structuredClone(fixtures['binding-required-positive']);
  binding.mode = mode; binding.rolloutScope = rolloutScope; binding.pathProfile = ref(path);
  binding.profiles = [ref(operation), ref(evaluator)]; binding.accountingProfile = ref(accounting);
  binding.budgets = structuredClone(accounting.limits);
  const policy = structuredClone(fixtures['effective-policy-positive']);
  policy.consumer = binding.consumer; policy.scope = binding.scope.repositoryRoot; policy.pathProfile = ref(path);
  policy.profiles = structuredClone(binding.profiles); policy.rules = [{ id: binding.scope.ruleId, parameters: {} }]; policy.exceptions = [];
  policy.aasIdentity = computeEffectivePolicyAasIdentity(policy); binding.policyAasIdentity = policy.aasIdentity;
  const promotion = structuredClone(fixtures['promotion-positive']);
  Object.assign(promotion, { policy: policy.aasIdentity, profiles: structuredClone(binding.profiles), analyzerAasIdentity: analyzer.aasIdentity,
    consumer: binding.consumer, ruleId: binding.scope.ruleId, rolloutScope, previousMode: mode === 'required' ? 'advisory' : 'shadow', nextMode: mode });
  promotion.aasIdentity = computePromotionAasIdentity(promotion);
  if (mode === 'shadow') delete binding.promotionRecordAasIdentity; else binding.promotionRecordAasIdentity = promotion.aasIdentity;
  binding.aasIdentity = computeBindingAasIdentity(binding);
  const bindingSet = { aasIdentity: '', bindings: [binding] }; bindingSet.aasIdentity = computeBindingSetAasIdentity(bindingSet);
  const coordinate = { aasIdentity: '', targetId: request.targets[0].id, consumer: binding.consumer, repository: binding.repository,
    subjectId: binding.scope.subjectId, pathProfile: ref(path), path: 'src/a.ts', ruleId: binding.scope.ruleId, rolloutCohorts: [] };
  coordinate.aasIdentity = computeTargetSelectionAasIdentity(coordinate);
  const candidate = { id: binding.id, aasIdentity: binding.aasIdentity, policyAasIdentity: policy.aasIdentity };
  request.profileAasIdentity = operation.aasIdentity; request.analyzerAasIdentity = analyzer.aasIdentity;
  request.accountingProfileAasIdentity = RESOURCE_ACCOUNTING_PROFILE_AAS_IDENTITY;
  request.budgets = structuredClone(accounting.limits); request.targets[0].input.pathProfile = ref(path);
  request.targets[0].input.limits = structuredClone(accounting.limits);
  request.targets[0].input.aasIdentity = computeOverlayAasIdentity(request.targets[0].input);
  request.targets[0].targetSelectionAasIdentity = coordinate.aasIdentity;
  request.targets[0].bindingSelection = { state: 'selected', selectedBindingId: binding.id, bindingAasIdentity: binding.aasIdentity,
    policyAasIdentity: policy.aasIdentity, candidateBindings: [candidate] };
  request.aasIdentity = computeRequestAasIdentity(request);
  const authorityBytes = {
    namespace: 'test.example/repository', bindingSet: encode(bindingSet), effectivePolicies: [encode(policy)],
    allowedPolicyAasIdentities: [policy.aasIdentity], profiles: [encode(accounting), encode(path), encode(operation), encode(evaluator)],
    allowedProfileAasIdentities: [accounting.aasIdentity, path.aasIdentity, operation.aasIdentity, evaluator.aasIdentity],
    analyzers: [encode(analyzer)], allowedAnalyzerAasIdentities: [analyzer.aasIdentity], promotionRecords: mode === 'shadow' ? [] : [encode(promotion)],
    allowedPromotionRecordAasIdentities: mode === 'shadow' ? [] : [promotion.aasIdentity], qualifiedPromotionRecordAasIdentities: mode === 'shadow' ? [] : [promotion.aasIdentity]
  };
  let resolveCalls = 0;
  const targetAuthority = { integrationContext: { installation: 'trusted' }, resolve: () => { resolveCalls += 1; return { [coordinate.targetId]: coordinate }; } };
  const create = (overrides = {}) => createInvocationKernel({ operatorAuthority: authorityBytes, targetAuthority,
    providerBudgets: structuredClone(accounting.limits), ...overrides });
  return { request, binding, bindingSet, policy, profiles: { path, operation, evaluator }, analyzer, promotion, coordinate,
    authorityBytes, targetAuthority, create, calls: () => resolveCalls };
}

function resultFor(state, plan, rawRequestLength) {
  const result = structuredClone(resultFixture), header = result.resolutions[0].diagnostic;
  result.requestAasIdentity = state.request.aasIdentity; result.analysisKeyAasIdentity = plan.analysisKey.aasIdentity;
  Object.assign(header, { requestAasIdentity: state.request.aasIdentity, analysisKeyAasIdentity: plan.analysisKey.aasIdentity,
    profileAasIdentity: state.profiles.operation.aasIdentity, analyzerAasIdentity: state.analyzer.aasIdentity,
    overlayAasIdentity: state.request.targets[0].input.aasIdentity, bindingAasIdentity: state.binding.aasIdentity,
    policyAasIdentity: state.policy.aasIdentity, mode: state.binding.mode,
    rolloutDisposition: state.binding.rolloutScope === 'all' ? 'included' : 'excluded', decisionTrace: structuredClone(state.request.targets[0].bindingSelection) });
  result.realizedCounters.inputBytes = rawRequestLength;
  result.realizedCounters.extensionBytes = canonicalRequestExtensionBytes(state.request);
  result.realizedCounters.overlayOperations = state.request.targets[0].input.operations.length;
  result.realizedCounters.targets = 1;
  result.realizedCounters.pathSegments = Math.max(result.realizedCounters.pathSegments, 2);
  result.realizedCounters.pathBytes = Math.max(result.realizedCounters.pathBytes, 8);
  resignResult(result); return result;
}

test('promotion and exception identities use their exact framing domains', () => {
  const state = makeState();
  assert.equal(computePromotionAasIdentity(state.promotion), state.promotion.aasIdentity);
  const exception = fixtures['exception-positive'];
  assert.equal(computeExceptionAasIdentity(exception), 'aas:v0:sha256:5cd536b1e65d83259a715ae2ec5f1a4683b11809634b7e581abe5fe9851fab9c');
  assert.deepEqual(exceptionIdentityProjection(exception), Object.fromEntries(Object.entries(exception).filter(([key]) => key !== 'aasIdentity')));
});

test('kernel derives a frozen plan and reconciles only raw bytes with its opaque capability', () => {
  const state = makeState(), kernel = state.create(), raw = encode(state.request);
  const { capability, plan } = kernel.preflightInvocation(raw);
  assert.ok(Object.isFrozen(kernel) && Object.isFrozen(capability) && Object.isFrozen(plan) && Object.isFrozen(plan.analysisKey));
  assert.equal(plan.analysisKey.requestAasIdentity, state.request.aasIdentity);
  const result = kernel.reconcileInvocationResult(capability, encode(resultFor(state, plan, raw.byteLength)));
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.realizedCounters));
  assert.throws(() => kernel.preflightInvocation({ request: state.request, operatorAuthority: {}, targetSelectionsByTarget: {},
    analysisKey: {}, providerBudgets: {} }), /Uint8Array/);
  assert.throws(() => kernel.preflightInvocation(new Uint8Array(new SharedArrayBuffer(16))), /non-shared ArrayBuffer/);
  const injected = structuredClone(state.request); injected.operatorAuthority = {}; assert.throws(() => kernel.preflightInvocation(encode(injected)), /schema/);
  assert.throws(() => kernel.reconcileInvocationResult(capability, result), /Uint8Array/);
  assert.throws(() => kernel.reconcileInvocationResult(capability, new Uint8Array(new SharedArrayBuffer(16))), /non-shared ArrayBuffer/);
});

test('kernel retains base validate-then-capture target resolver getter ordering', () => {
  const state = makeState();
  const trace = [];
  const targetAuthority = {};
  let resolveReads = 0;
  Object.defineProperties(targetAuthority, {
    resolve: {
      enumerable: true,
      get() { resolveReads += 1; trace.push(`resolve:${resolveReads}`); return () => ({ [state.coordinate.targetId]: state.coordinate }); },
    },
    integrationContext: {
      enumerable: true,
      get() { trace.push('integrationContext'); return { installation: 'trusted' }; },
    },
  });
  const kernel = state.create({ targetAuthority });
  assert.equal(typeof kernel.preflightInvocation, 'function');
  assert.deepEqual(trace, ['resolve:1', 'resolve:2', 'integrationContext']);

  const throwing = {};
  Object.defineProperties(throwing, {
    resolve: {
      enumerable: true,
      get() {
        trace.push('throwing-resolve');
        if (trace.filter((item) => item === 'throwing-resolve').length === 2) throw new Error('capture-failed');
        return () => ({});
      },
    },
    integrationContext: { enumerable: true, get() { trace.push('unexpected-integrationContext'); return {}; } },
  });
  trace.length = 0;
  assert.throws(() => state.create({ targetAuthority: throwing }), /capture-failed/);
  assert.deepEqual(trace, ['throwing-resolve', 'throwing-resolve']);
});

test('analysis key binds the exact componentwise effective budgets from every invocation authority', () => {
  const plans = [];
  for (const [source, ceiling] of [['request', 900000], ['overlay', 800000], ['binding', 700000]]) {
    const state = makeState();
    if (source === 'request') state.request.budgets.maxDiagnostics = ceiling;
    if (source === 'overlay') {
      state.request.targets[0].input.limits.maxDiagnostics = ceiling;
      state.request.targets[0].input.aasIdentity = computeOverlayAasIdentity(state.request.targets[0].input);
    }
    if (source === 'binding') {
      state.binding.budgets.maxDiagnostics = ceiling;
      state.binding.aasIdentity = computeBindingAasIdentity(state.binding);
      state.bindingSet.bindings = [state.binding]; state.bindingSet.aasIdentity = computeBindingSetAasIdentity(state.bindingSet);
      state.authorityBytes.bindingSet = encode(state.bindingSet);
      Object.assign(state.request.targets[0].bindingSelection, { bindingAasIdentity: state.binding.aasIdentity,
        candidateBindings: [{ id: state.binding.id, aasIdentity: state.binding.aasIdentity, policyAasIdentity: state.policy.aasIdentity }] });
    }
    state.request.aasIdentity = computeRequestAasIdentity(state.request);
    const { plan } = state.create().preflightInvocation(encode(state.request));
    assert.deepEqual(plan.analysisKey.budgets, plan.effectiveBudgets, source);
    assert.equal(plan.effectiveBudgets.maxDiagnostics, ceiling, source);
    plans.push(plan);
  }
  assert.equal(new Set(plans.map(({ analysisKey }) => analysisKey.aasIdentity)).size, plans.length);
});

test('oversized admission fails before copying, parsing, or target resolution', () => {
  const state = makeState(), kernel = state.create({ ingressLimits: { maxBytes: 5000, maxDepth: 128 } });
  const originalSlice = Uint8Array.prototype.slice;
  let copies = 0;
  Uint8Array.prototype.slice = function (...args) { copies += 1; return Reflect.apply(originalSlice, this, args); };
  try { assert.throws(() => kernel.preflightInvocation(new Uint8Array(5001)), /exceeds maxBytes/); }
  finally { Uint8Array.prototype.slice = originalSlice; }
  assert.equal(copies, 0);
  assert.equal(state.calls(), 0);
});

test('schema admission diagnostics remain bounded for high-fanout malformed documents', async () => {
  const { assertSchema } = await import('../lib/schema-admission.mjs');
  const malformed = structuredClone(fixtures['request-positive']);
  malformed.targets = Array.from({ length: 10000 }, () => ({}));
  assert.throws(() => assertSchema(malformed, 'request', 'high-fanout request'), (error) => {
    assert.match(error.message, /^invalid AAS high-fanout request schema:/);
    assert.ok(error.message.length <= 512, `schema failure length was ${error.message.length}`);
    return true;
  });
});

test('authority bytes are copied at bootstrap and later mutation has no effect', () => {
  const state = makeState(), kernel = state.create();
  for (const bytes of [state.authorityBytes.bindingSet, ...state.authorityBytes.effectivePolicies, ...state.authorityBytes.profiles,
    ...state.authorityBytes.analyzers, ...state.authorityBytes.promotionRecords]) bytes.fill(0);
  assert.doesNotThrow(() => kernel.preflightInvocation(encode(state.request)));
});

test('resolver coordinates reject mutation, non-NFC paths, forged cohorts, and request resolver lookalikes', () => {
  for (const mutate of [
    (coordinate) => { coordinate.path = 'src/changed.ts'; },
    (coordinate) => { coordinate.path = 'src/cafe\u0301.ts'; coordinate.aasIdentity = computeTargetSelectionAasIdentity(coordinate); },
    (coordinate) => { coordinate.rolloutCohorts.push('forged'); }
  ]) {
    const state = makeState(), coordinate = structuredClone(state.coordinate); mutate(coordinate);
    state.targetAuthority.resolve = () => ({ [coordinate.targetId]: coordinate });
    assert.throws(() => state.create().preflightInvocation(encode(state.request)), /target-selection|portable path/);
  }
  const state = makeState(), request = structuredClone(state.request); request.resolve = () => state.coordinate;
  assert.throws(() => state.create().preflightInvocation(request), /Uint8Array/);
  assert.throws(() => state.create().preflightInvocation(new Proxy(encode(state.request), {})), /Uint8Array/);
  const captured = makeState(), kernel = captured.create(); captured.targetAuthority.resolve = () => { throw new Error('replacement resolver'); };
  captured.targetAuthority.integrationContext.installation = 'mutated';
  assert.doesNotThrow(() => kernel.preflightInvocation(encode(captured.request)));
  const returned = makeState(); let resolverResult;
  returned.targetAuthority.resolve = () => (resolverResult = { [returned.coordinate.targetId]: returned.coordinate });
  const returnedKernel = returned.create(), returnedRaw = encode(returned.request);
  const admitted = returnedKernel.preflightInvocation(returnedRaw);
  resolverResult[returned.coordinate.targetId].path = 'src/mutated-after-return.ts';
  assert.equal(admitted.plan.request.targets[0].targetSelectionAasIdentity, returned.coordinate.aasIdentity);
  assert.doesNotThrow(() => returnedKernel.reconcileInvocationResult(admitted.capability,
    encode(resultFor(returned, admitted.plan, returnedRaw.byteLength))));
});

test('schema admission rejects extra and missing fields in every authority document family', () => {
  for (const [family, field, missing] of [
    ['bindingSet', 'bindings', 'bindings'], ['effectivePolicies', 'rules', 'rules'], ['profiles', 'schemas', 'schemas'],
    ['analyzers', 'configuration', 'configuration'], ['promotionRecords', 'evidence', 'evidence']
  ]) {
    for (const kind of ['extra', 'missing']) {
      const state = makeState();
      const slot = family === 'bindingSet' ? state.authorityBytes.bindingSet : state.authorityBytes[family][0];
      const document = JSON.parse(new TextDecoder().decode(slot));
      if (kind === 'extra') document.unexpected = true; else delete document[missing];
      if (family === 'bindingSet' && kind === 'missing') delete document[field];
      if (family === 'bindingSet' && kind === 'extra') document.unexpected = true;
      if (family === 'bindingSet') state.authorityBytes.bindingSet = encode(document); else state.authorityBytes[family][0] = encode(document);
      assert.throws(() => state.create(), /schema/, `${family}/${kind}`);
    }
  }
  for (const kind of ['extra', 'missing']) {
    const state = makeState(), set = JSON.parse(new TextDecoder().decode(state.authorityBytes.bindingSet));
    if (kind === 'extra') set.bindings[0].unexpected = true; else delete set.bindings[0].owner;
    state.authorityBytes.bindingSet = encode(set);
    assert.throws(() => state.create(), /schema/, `binding/${kind}`);
  }
});

test('profile dependency closure rejects missing, aliased, cyclic, and analyzer references', () => {
  for (const mutation of ['missing', 'alias', 'cycle', 'analyzer']) {
    const state = makeState();
    const docs = state.authorityBytes.profiles.map((bytes) => JSON.parse(new TextDecoder().decode(bytes)));
    const operation = docs.find(({ kind }) => kind === 'operation');
    if (mutation === 'missing') operation.dependencies = [{ version: '1', id: 'missing@1', aasIdentity: `aas:v0:sha256:${'f'.repeat(64)}` }];
    if (mutation === 'alias') operation.dependencies = [{ ...ref(docs.find(({ kind }) => kind === 'evaluator')), id: 'alias@1' }];
    if (mutation === 'cycle') operation.dependencies = [ref(operation)];
    if (mutation === 'analyzer') {
      const analyzer = JSON.parse(new TextDecoder().decode(state.authorityBytes.analyzers[0])); analyzer.profiles[0].id = 'alias@1';
      analyzer.aasIdentity = computeAnalyzerAasIdentity(analyzer); state.authorityBytes.analyzers = [encode(analyzer)];
      state.authorityBytes.allowedAnalyzerAasIdentities = [analyzer.aasIdentity];
    } else {
      operation.aasIdentity = computeProfileAasIdentity(operation); state.authorityBytes.profiles = docs.map(encode);
      state.authorityBytes.allowedProfileAasIdentities = docs.map(({ aasIdentity }) => aasIdentity);
    }
    assert.throws(() => state.create(), /profile|dependency|evaluator/);
  }
});

test('promotion records must be supplied, qualified, exact, adjacent, and analyzer-bound', () => {
  const valid = makeState(); assert.doesNotThrow(() => valid.create().preflightInvocation(encode(valid.request)));
  for (const mutation of ['missing', 'unqualified', 'mismatch', 'nonadjacent']) {
    const state = makeState();
    if (mutation === 'missing') { state.authorityBytes.promotionRecords = []; state.authorityBytes.allowedPromotionRecordAasIdentities = []; }
    if (mutation === 'unqualified') state.authorityBytes.qualifiedPromotionRecordAasIdentities = [];
    if (mutation === 'mismatch' || mutation === 'nonadjacent') {
      const promotion = structuredClone(state.promotion);
      if (mutation === 'mismatch') promotion.consumer = 'other-consumer'; else promotion.previousMode = 'shadow';
      promotion.aasIdentity = computePromotionAasIdentity(promotion); state.authorityBytes.promotionRecords = [encode(promotion)];
      state.authorityBytes.allowedPromotionRecordAasIdentities = [promotion.aasIdentity]; state.authorityBytes.qualifiedPromotionRecordAasIdentities = [promotion.aasIdentity];
      const set = structuredClone(state.bindingSet); set.bindings[0].promotionRecordAasIdentity = promotion.aasIdentity;
      set.bindings[0].aasIdentity = computeBindingAasIdentity(set.bindings[0]); set.aasIdentity = computeBindingSetAasIdentity(set);
      state.authorityBytes.bindingSet = encode(set);
    }
    assert.throws(() => state.create(), /promotion/);
  }
  const analyzerMismatch = makeState(), promotion = structuredClone(analyzerMismatch.promotion);
  promotion.analyzerAasIdentity = `aas:v0:sha256:${'f'.repeat(64)}`; promotion.aasIdentity = computePromotionAasIdentity(promotion);
  analyzerMismatch.authorityBytes.promotionRecords = [encode(promotion)]; analyzerMismatch.authorityBytes.allowedPromotionRecordAasIdentities = [promotion.aasIdentity];
  analyzerMismatch.authorityBytes.qualifiedPromotionRecordAasIdentities = [promotion.aasIdentity];
  const set = structuredClone(analyzerMismatch.bindingSet); set.bindings[0].promotionRecordAasIdentity = promotion.aasIdentity;
  set.bindings[0].aasIdentity = computeBindingAasIdentity(set.bindings[0]); set.aasIdentity = computeBindingSetAasIdentity(set);
  analyzerMismatch.authorityBytes.bindingSet = encode(set);
  assert.throws(() => analyzerMismatch.create().preflightInvocation(encode(analyzerMismatch.request)), /authoritative-catalog|analyzer/);

  const selectedMismatch = makeState(), otherAnalyzer = structuredClone(selectedMismatch.analyzer);
  otherAnalyzer.configuration = [{ name: 'variant', value: true }]; otherAnalyzer.aasIdentity = computeAnalyzerAasIdentity(otherAnalyzer);
  selectedMismatch.authorityBytes.analyzers.push(encode(otherAnalyzer));
  selectedMismatch.authorityBytes.allowedAnalyzerAasIdentities.push(otherAnalyzer.aasIdentity);
  const otherPromotion = structuredClone(selectedMismatch.promotion);
  otherPromotion.analyzerAasIdentity = otherAnalyzer.aasIdentity; otherPromotion.aasIdentity = computePromotionAasIdentity(otherPromotion);
  selectedMismatch.authorityBytes.promotionRecords = [encode(otherPromotion)];
  selectedMismatch.authorityBytes.allowedPromotionRecordAasIdentities = [otherPromotion.aasIdentity];
  selectedMismatch.authorityBytes.qualifiedPromotionRecordAasIdentities = [otherPromotion.aasIdentity];
  const mismatchSet = structuredClone(selectedMismatch.bindingSet);
  mismatchSet.bindings[0].promotionRecordAasIdentity = otherPromotion.aasIdentity;
  mismatchSet.bindings[0].aasIdentity = computeBindingAasIdentity(mismatchSet.bindings[0]);
  mismatchSet.aasIdentity = computeBindingSetAasIdentity(mismatchSet);
  selectedMismatch.authorityBytes.bindingSet = encode(mismatchSet);
  selectedMismatch.request.targets[0].bindingSelection.bindingAasIdentity = mismatchSet.bindings[0].aasIdentity;
  selectedMismatch.request.targets[0].bindingSelection.candidateBindings[0].aasIdentity = mismatchSet.bindings[0].aasIdentity;
  selectedMismatch.request.aasIdentity = computeRequestAasIdentity(selectedMismatch.request);
  const mismatchKernel = selectedMismatch.create();
  assert.throws(() => mismatchKernel.preflightInvocation(encode(selectedMismatch.request)), /promotion analyzer does not equal verified request analyzer/);
});

test('profile limits are not effective invocation budget authorities', () => {
  const state = makeState({ profileMaxDiagnostics: 1 });
  const { plan } = state.create().preflightInvocation(encode(state.request));
  assert.equal(plan.effectiveBudgets.maxDiagnostics, accounting.limits.maxDiagnostics);
});

test('actual whitespace-amplified request bytes are charged and cheap rejection precedes resolver', () => {
  const state = makeState(); state.request.budgets.maxInputBytes = 5000; state.request.aasIdentity = computeRequestAasIdentity(state.request);
  const canonical = encode(state.request), amplified = new TextEncoder().encode(`${' '.repeat(6000)}${new TextDecoder().decode(canonical)}`);
  assert.ok(canonical.byteLength < state.request.budgets.maxInputBytes);
  const kernel = state.create(); assert.throws(() => kernel.preflightInvocation(amplified), /maxInputBytes|known inputBytes/); assert.equal(state.calls(), 0);
});

test('raw overlay path lower bounds handle empty operations and distinct target paths before resolution', () => {
  const empty = makeState(), emptyRequest = structuredClone(empty.request);
  emptyRequest.targets[0].input.operations = [];
  emptyRequest.targets[0].input.aasIdentity = computeOverlayAasIdentity(emptyRequest.targets[0].input);
  emptyRequest.aasIdentity = computeRequestAasIdentity(emptyRequest);
  assert.doesNotThrow(() => empty.create().preflightInvocation(encode(emptyRequest)));

  const state = makeState(), second = structuredClone(state.request.targets[0]);
  second.id = 'target-2'; second.input.operations[0].path = 'other/deeply/nested/overlay-path.ts';
  second.input.aasIdentity = computeOverlayAasIdentity(second.input);
  const secondCoordinate = structuredClone(state.coordinate);
  secondCoordinate.targetId = second.id; secondCoordinate.path = 'src/deep/target-2.ts';
  secondCoordinate.aasIdentity = computeTargetSelectionAasIdentity(secondCoordinate);
  second.targetSelectionAasIdentity = secondCoordinate.aasIdentity;
  state.request.targets.push(second); state.request.budgets.maxPathBytes = 12;
  state.request.aasIdentity = computeRequestAasIdentity(state.request);
  state.targetAuthority.resolve = () => { throw new Error('resolver must not run'); };
  assert.throws(() => state.create().preflightInvocation(encode(state.request)), /known pathBytes/);
  assert.equal(state.calls(), 0);
});

test('selected binding, policy, and exception paths contribute to the reconciled path lower bound', () => {
  const state = makeState({ mode: 'shadow' }), exception = structuredClone(fixtures['exception-positive']);
  exception.ruleId = state.binding.scope.ruleId; exception.scope = 'src/exception/scope/with/a/long/path.ts';
  exception.pathProfile = ref(state.profiles.path); exception.aasIdentity = computeExceptionAasIdentity(exception);
  const policy = structuredClone(state.policy); policy.exceptions = [exception]; policy.aasIdentity = computeEffectivePolicyAasIdentity(policy);
  const binding = structuredClone(state.binding); binding.policyAasIdentity = policy.aasIdentity; binding.exceptions = [exception.aasIdentity];
  binding.aasIdentity = computeBindingAasIdentity(binding);
  const set = { aasIdentity: '', bindings: [binding] }; set.aasIdentity = computeBindingSetAasIdentity(set);
  state.authorityBytes.effectivePolicies = [encode(policy)]; state.authorityBytes.allowedPolicyAasIdentities = [policy.aasIdentity];
  state.authorityBytes.bindingSet = encode(set); state.binding = binding; state.policy = policy;
  Object.assign(state.request.targets[0].bindingSelection, { bindingAasIdentity: binding.aasIdentity, policyAasIdentity: policy.aasIdentity,
    candidateBindings: [{ id: binding.id, aasIdentity: binding.aasIdentity, policyAasIdentity: policy.aasIdentity }] });
  state.request.aasIdentity = computeRequestAasIdentity(state.request);
  const kernel = state.create(), raw = encode(state.request), preflight = kernel.preflightInvocation(raw);
  const result = resultFor(state, preflight.plan, raw.byteLength);
  result.realizedCounters.pathBytes = 8; result.realizedCounters.pathSegments = 2; resignResult(result);
  assert.throws(() => kernel.reconcileInvocationResult(preflight.capability, encode(result)), /path(?:Bytes|Segments) underreports/);
});

test('path counter underreport, raw result parsing, and per-kernel capability isolation fail closed', () => {
  const state = makeState(), first = state.create(), second = state.create(), raw = encode(state.request);
  const preflight = first.preflightInvocation(raw), result = resultFor(state, preflight.plan, raw.byteLength);
  result.realizedCounters.pathBytes = 1; resignResult(result);
  assert.throws(() => first.reconcileInvocationResult(preflight.capability, encode(result)), /pathBytes underreports/);
  assert.throws(() => second.reconcileInvocationResult(preflight.capability, encode(result)), /per-kernel/);
  assert.throws(() => first.reconcileInvocationResult(structuredClone(preflight.capability), encode(result)), /per-kernel/);
  assert.throws(() => first.reconcileInvocationResult(preflight.capability, new TextEncoder().encode(`${JSON.stringify(result)} trailing`)), /trailing/);
  const duplicate = new TextEncoder().encode(JSON.stringify(result).replace('{', '{"kind":"result",'));
  assert.throws(() => first.reconcileInvocationResult(preflight.capability, duplicate), /duplicate/);
});

test('binding selection remains permutation-stable with complete ordered candidates', () => {
  const state = makeState({ mode: 'shadow' }), lower = structuredClone(state.binding);
  delete lower.scope.subjectId; lower.id = 'lower'; lower.aasIdentity = computeBindingAasIdentity(lower);
  const decisions = [[state.binding, lower], [lower, state.binding]].map((bindings) => {
    const set = { aasIdentity: '', bindings }; set.aasIdentity = computeBindingSetAasIdentity(set);
    const derived = deriveBindingSelection(set, state.coordinate);
    assert.equal(derived.selected.id, state.binding.id);
    return derived.decision;
  });
  assert.deepEqual(decisions[0], decisions[1]);
  assert.deepEqual(decisions[0].candidateBindings.map(({ id }) => id), [state.binding.id, lower.id]);
});

test('prefix index preserves full-catalog parity with many unrelated bindings', () => {
  const state = makeState({ mode: 'shadow' }), bindings = [state.binding], policies = [state.policy];
  for (let index = 0; index < 512; index += 1) {
    const policy = structuredClone(state.policy), path = `unrelated-${String(index).padStart(4, '0')}`;
    policy.scope = path; policy.aasIdentity = computeEffectivePolicyAasIdentity(policy); policies.push(policy);
    const binding = structuredClone(state.binding);
    binding.id = `unrelated-${index}`; binding.scope.repositoryRoot = path; binding.policyAasIdentity = policy.aasIdentity;
    binding.aasIdentity = computeBindingAasIdentity(binding); bindings.push(binding);
  }
  const set = { aasIdentity: '', bindings: [...bindings].reverse() }; set.aasIdentity = computeBindingSetAasIdentity(set);
  const expected = deriveBindingSelection(set, state.coordinate).decision;
  assert.deepEqual(expected, state.request.targets[0].bindingSelection);
  state.authorityBytes.bindingSet = encode(set); state.authorityBytes.effectivePolicies = policies.map(encode);
  state.authorityBytes.allowedPolicyAasIdentities = policies.map(({ aasIdentity }) => aasIdentity);
  const { plan } = state.create().preflightInvocation(encode(state.request));
  assert.deepEqual(plan.request.targets[0].bindingSelection, expected);
  assert.equal(expected.candidateBindings.length, 1);
});
