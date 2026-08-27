import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  RESOURCE_ACCOUNTING_PROFILE_AAS_IDENTITY, canonicalRequestExtensionBytes, canonicalRequestWireBytes,
  canonicalResultOutputBytes, computeAnalysisKeyAasIdentity, computeAnalyzerAasIdentity, computeBindingAasIdentity,
  computeEffectivePolicyAasIdentity, computeOverlayAasIdentity, computeProfileAasIdentity, computeRequestAasIdentity,
  computeResultAasIdentity, computeTargetSelectionAasIdentity, preflightInvocation, reconcileInvocationResult
} from '../lib/result-validation.mjs';

const fixtures = JSON.parse(await readFile(new URL('../vectors/schema/definition-fixtures.json', import.meta.url)));
const accounting = JSON.parse(await readFile(new URL('../profiles/resource-accounting-v0-1.json', import.meta.url)));
const resultFixture = JSON.parse(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
const ref = ({ aasIdentity, id, definitionVersion }) => ({ version: definitionVersion, id, aasIdentity });
const makeProfile = (kind, id) => {
  const artifact = { aasIdentity: 'aas:v0:sha256:' + '3'.repeat(64), contentDigest: 'sha256:' + '4'.repeat(64), byteLength: 1, mediaType: 'application/octet-stream' };
  const value = { aasIdentity: '', kind, id, definitionVersion: '1', schemas: [artifact], dependencies: [], limits: structuredClone(accounting.limits), semanticsArtifacts: [artifact], definitionVectorSuites: [artifact] };
  value.aasIdentity = computeProfileAasIdentity(value); return value;
};
const resignResult = (result) => {
  result.realizedCounters.totalWork = ['entries', 'logicalBytes', 'readBytes', 'overlayOperations', 'targets', 'evidenceReferences', 'extensionBytes', 'diagnostics']
    .reduce((sum, counter) => sum + result.realizedCounters[counter], 0);
  result.realizedCounters.outputBytes = canonicalResultOutputBytes(result);
  result.aasIdentity = computeResultAasIdentity(result);
  for (const resolution of result.resolutions) resolution.diagnostic.resultAasIdentity = result.aasIdentity;
};

function makeInvocation({ rolloutScope = 'all', additionalBindings = [] } = {}) {
  const request = structuredClone(fixtures['request-positive']);
  const operation = makeProfile('operation', 'validate-overlay-operation@1');
  const evaluator = makeProfile('evaluator', 'overlay-evaluator@1');
  const path = makeProfile('path', 'agent-architecture-portable-path-unicode17@1');
  request.profileAasIdentity = operation.aasIdentity;
  request.accountingProfileAasIdentity = RESOURCE_ACCOUNTING_PROFILE_AAS_IDENTITY;
  request.budgets = structuredClone(accounting.limits);
  request.targets[0].input.pathProfile = ref(path);
  request.targets[0].input.limits = structuredClone(accounting.limits);
  request.targets[0].input.aasIdentity = computeOverlayAasIdentity(request.targets[0].input);
  const binding = structuredClone(fixtures['binding-required-positive']);
  binding.pathProfile = ref(path); binding.profiles = [ref(operation), ref(evaluator)];
  binding.accountingProfile = ref(accounting); binding.budgets = structuredClone(accounting.limits); binding.rolloutScope = rolloutScope;
  const policy = structuredClone(fixtures['effective-policy-positive']);
  policy.consumer = binding.consumer; policy.scope = binding.scope.path ?? binding.scope.repositoryRoot;
  policy.pathProfile = ref(path); policy.profiles = structuredClone(binding.profiles); policy.rules = [{ id: 'rule-1', parameters: {} }];
  policy.aasIdentity = computeEffectivePolicyAasIdentity(policy); binding.policyAasIdentity = policy.aasIdentity;
  binding.aasIdentity = computeBindingAasIdentity(binding);
  for (const extra of additionalBindings) extra.aasIdentity = computeBindingAasIdentity(extra);
  const coordinate = { aasIdentity: '', targetId: 'target-1', consumer: binding.consumer, repository: binding.repository,
    subjectId: binding.scope.subjectId, pathProfile: ref(path), path: 'src/a.ts', ruleId: binding.scope.ruleId, rolloutCohorts: [] };
  coordinate.aasIdentity = computeTargetSelectionAasIdentity(coordinate);
  const disposition = rolloutScope === 'all' ? 'included' : 'excluded';
  const candidates = [binding, ...additionalBindings].map(({ id, aasIdentity, policyAasIdentity }) => ({ id, aasIdentity, policyAasIdentity }))
    .sort((left, right) => left.aasIdentity < right.aasIdentity ? -1 : 1);
  const selectedCandidate = candidates.find(({ aasIdentity }) => aasIdentity === binding.aasIdentity);
  request.targets[0].targetSelectionAasIdentity = coordinate.aasIdentity;
  request.targets[0].bindingSelection = { state: 'selected', selectedBindingId: selectedCandidate.id, bindingAasIdentity: selectedCandidate.aasIdentity,
    policyAasIdentity: selectedCandidate.policyAasIdentity, candidateBindings: candidates };
  const analyzer = { aasIdentity: '', implementationArtifacts: [{ aasIdentity: 'aas:v0:sha256:' + '1'.repeat(64), contentDigest: 'sha256:' + '2'.repeat(64), byteLength: 1, mediaType: 'application/octet-stream' }], configuration: [], profiles: [ref(evaluator)] };
  analyzer.aasIdentity = computeAnalyzerAasIdentity(analyzer); request.analyzerAasIdentity = analyzer.aasIdentity;
  request.aasIdentity = computeRequestAasIdentity(request);
  const analysisKey = { aasIdentity: '', operationProfile: ref(operation), evaluatorProfiles: [ref(evaluator)],
    inputAasIdentities: [request.snapshotAasIdentity, request.targets[0].input.aasIdentity], budgets: structuredClone(accounting.limits),
    accountingProfile: ref(accounting), semanticExtensions: { request: request.extensions, criticalRequest: request.criticalExtensions,
      targets: request.targets.map(({ id, extensions, criticalExtensions }) => ({ id, extensions, criticalExtensions })) },
    requestAasIdentity: request.aasIdentity, operation: request.operation, profileAasIdentity: operation.aasIdentity,
    analyzerAasIdentity: analyzer.aasIdentity, snapshotAasIdentity: request.snapshotAasIdentity };
  analysisKey.aasIdentity = computeAnalysisKeyAasIdentity(analysisKey);
  const authority = { namespace: 'test.example/repository', bindings: [binding, ...additionalBindings], effectivePolicies: [policy],
    profiles: [accounting, path, operation, evaluator], analyzers: [analyzer], allowedPolicyAasIdentities: [policy.aasIdentity],
    allowedProfileAasIdentities: [accounting.aasIdentity, path.aasIdentity, operation.aasIdentity, evaluator.aasIdentity],
    allowedAnalyzerAasIdentities: [analyzer.aasIdentity] };
  const result = structuredClone(resultFixture);
  result.requestAasIdentity = request.aasIdentity; result.analysisKeyAasIdentity = analysisKey.aasIdentity;
  const header = result.resolutions[0].diagnostic;
  Object.assign(header, { requestAasIdentity: request.aasIdentity, analysisKeyAasIdentity: analysisKey.aasIdentity,
    profileAasIdentity: operation.aasIdentity, analyzerAasIdentity: analyzer.aasIdentity, overlayAasIdentity: request.targets[0].input.aasIdentity,
    bindingAasIdentity: binding.aasIdentity, policyAasIdentity: policy.aasIdentity, mode: binding.mode, rolloutDisposition: disposition,
    decisionTrace: structuredClone(request.targets[0].bindingSelection) });
  result.realizedCounters.inputBytes = canonicalRequestWireBytes(request);
  result.realizedCounters.extensionBytes = canonicalRequestExtensionBytes(request);
  result.realizedCounters.overlayOperations = request.targets[0].input.operations.length;
  result.realizedCounters.targets = 1; resignResult(result);
  return { invocation: { request, result, analysisKey, targetSelectionsByTarget: { 'target-1': coordinate }, operatorAuthority: authority },
    authority, binding, policy, path, operation, evaluator, analyzer };
}

test('effective policy identity uses the normative aas.policy.v0 framing domain', () => {
  assert.equal(computeEffectivePolicyAasIdentity(fixtures['effective-policy-positive']),
    'aas:v0:sha256:95174138ce7ae7edb2db2a9f11a4c6c126eb008d2023abb85b418ba2e8739711');
});

test('operator authority verifies artifacts and brands a deeply frozen preflight capability', () => {
  const state = makeInvocation(); const raw = canonicalRequestWireBytes(state.invocation.request);
  const capability = preflightInvocation(state.invocation, raw);
  assert.ok(Object.isFrozen(capability) && Object.isFrozen(capability.selectedByTarget));
  assert.doesNotThrow(() => reconcileInvocationResult(capability, state.invocation.result));
  assert.throws(() => reconcileInvocationResult(structuredClone(capability), state.invocation.result), /authentic completed preflight capability/);
  assert.throws(() => reconcileInvocationResult(capability, state.invocation.result, raw), /replacement raw byte arguments are forbidden/);
});

test('authority omission/substitution and policy/profile/analyzer substitutions fail closed', () => {
  for (const [name, mutate, expected] of [
    ['binding omission', (s) => { s.authority.bindings = []; }, /authoritative-catalog derivation/],
    ['binding substitution', (s) => { s.binding.budgets.maxReadBytes -= 1; }, /binding aasIdentity does not match/],
    ['policy identity', (s) => { s.policy.rules[0].parameters.changed = true; }, /effective policy artifact aasIdentity mismatch/],
    ['duplicate rules', (s) => { s.policy.rules.push(structuredClone(s.policy.rules[0])); s.policy.aasIdentity = computeEffectivePolicyAasIdentity(s.policy); s.authority.allowedPolicyAasIdentities = [s.policy.aasIdentity]; }, /duplicate rule IDs/],
    ['profile substitution', (s) => { s.authority.allowedProfileAasIdentities = s.authority.allowedProfileAasIdentities.filter((id) => id !== s.evaluator.aasIdentity); }, /exact supplied document set|not operator-authorized/],
    ['analyzer substitution', (s) => { s.analyzer.profiles = []; }, /analyzer artifact aasIdentity mismatch/]
  ]) {
    const state = makeInvocation(); mutate(state); assert.throws(() => preflightInvocation(state.invocation, canonicalRequestWireBytes(state.invocation.request)), expected, name);
  }
});

test('path namespaces, lower-rank conflicts, rollout closure, and known budget exhaustion are enforced', () => {
  const mismatch = makeInvocation(); mismatch.invocation.targetSelectionsByTarget['target-1'].pathProfile.aasIdentity = 'aas:v0:sha256:' + 'f'.repeat(64);
  mismatch.invocation.targetSelectionsByTarget['target-1'].aasIdentity = computeTargetSelectionAasIdentity(mismatch.invocation.targetSelectionsByTarget['target-1']);
  mismatch.invocation.request.targets[0].targetSelectionAasIdentity = mismatch.invocation.targetSelectionsByTarget['target-1'].aasIdentity;
  mismatch.invocation.request.aasIdentity = computeRequestAasIdentity(mismatch.invocation.request);
  assert.throws(() => preflightInvocation(mismatch.invocation, canonicalRequestWireBytes(mismatch.invocation.request)), /path-profile mismatch/);

  const base = makeInvocation();
  const lowA = structuredClone(base.binding); delete lowA.scope.subjectId; delete lowA.scope.ruleId; lowA.id = 'low-a'; lowA.aasIdentity = computeBindingAasIdentity(lowA);
  const lowB = structuredClone(lowA); lowB.id = 'low-b'; lowB.mode = 'shadow'; delete lowB.promotionRecordAasIdentity; lowB.aasIdentity = computeBindingAasIdentity(lowB);
  base.authority.bindings.push(lowA, lowB);
  assert.throws(() => preflightInvocation(base.invocation, canonicalRequestWireBytes(base.invocation.request)), /binding-set-conflict/);

  const absent = makeInvocation(); absent.authority.bindings = [];
  absent.invocation.request.targets[0].bindingSelection = { state: 'absent', reason: 'binding-missing', candidateBindings: [] };
  absent.invocation.request.aasIdentity = computeRequestAasIdentity(absent.invocation.request);
  absent.invocation.analysisKey.requestAasIdentity = absent.invocation.request.aasIdentity;
  absent.invocation.analysisKey.evaluatorProfiles = [];
  absent.invocation.analysisKey.aasIdentity = computeAnalysisKeyAasIdentity(absent.invocation.analysisKey);
  const absentCapability = preflightInvocation(absent.invocation, canonicalRequestWireBytes(absent.invocation.request));
  assert.equal(absentCapability.rolloutByTarget['target-1'], 'not-applicable');
  const absentResult = absent.invocation.result;
  absentResult.requestAasIdentity = absent.invocation.request.aasIdentity;
  absentResult.analysisKeyAasIdentity = absent.invocation.analysisKey.aasIdentity;
  const absentResolution = absentResult.resolutions[0];
  Object.assign(absentResolution, { resolution: 'needs-input', reason: 'binding-missing' }); delete absentResolution.verdict;
  Object.assign(absentResolution.diagnostic, { requestAasIdentity: absent.invocation.request.aasIdentity,
    analysisKeyAasIdentity: absent.invocation.analysisKey.aasIdentity, resolution: 'needs-input', bindingState: 'absent',
    rolloutDisposition: 'included', decisionTrace: structuredClone(absent.invocation.request.targets[0].bindingSelection) });
  delete absentResolution.diagnostic.verdict; delete absentResolution.diagnostic.mode;
  delete absentResolution.diagnostic.bindingAasIdentity; delete absentResolution.diagnostic.policyAasIdentity;
  absentResult.realizedCounters.inputBytes = canonicalRequestWireBytes(absent.invocation.request); resignResult(absentResult);
  assert.throws(() => reconcileInvocationResult(absentCapability, absentResult), /binding rollout disposition mismatch/);

  const exhausted = makeInvocation(); exhausted.invocation.analysisKey.budgets.maxOverlayOperations = 1;
  exhausted.invocation.request.targets[0].input.operations.push(structuredClone(exhausted.invocation.request.targets[0].input.operations[0]));
  exhausted.invocation.request.targets[0].input.aasIdentity = computeOverlayAasIdentity(exhausted.invocation.request.targets[0].input);
  exhausted.invocation.request.aasIdentity = computeRequestAasIdentity(exhausted.invocation.request);
  exhausted.invocation.analysisKey.requestAasIdentity = exhausted.invocation.request.aasIdentity;
  exhausted.invocation.analysisKey.inputAasIdentities[1] = exhausted.invocation.request.targets[0].input.aasIdentity;
  exhausted.invocation.analysisKey.aasIdentity = computeAnalysisKeyAasIdentity(exhausted.invocation.analysisKey);
  assert.throws(() => preflightInvocation(exhausted.invocation, canonicalRequestWireBytes(exhausted.invocation.request)), /known overlayOperations lower bound exceeds/);
});
