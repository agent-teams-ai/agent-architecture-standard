import { createHash } from 'node:crypto';
import { assertIdentityDocumentPathInvariants } from './document-validation.mjs';
import { assertPortablePath } from './portable-path.mjs';
import { assertSchema, parseSchemaBytes } from './schema-admission.mjs';

export const terminalFields = ['included', 'policyExcluded', 'unreadable', 'unsupported', 'unstable', 'unknown', 'budgetExhausted'];
const severities = ['info', 'warning', 'error', 'critical'];

const canonicalize = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
};
const u32be = (value) => { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(value); return bytes; };
const u64be = (value) => { const bytes = Buffer.alloc(8); bytes.writeBigUInt64BE(BigInt(value)); return bytes; };

const computeFramedIdentity = (domain, value) => {
  const projection = structuredClone(value);
  delete projection.aasIdentity;
  const payload = Buffer.from(canonicalize(projection), 'utf8');
  const magic = Buffer.from('AAS-ID');
  const profile = Buffer.from('agent-architecture-canonical-json-rfc8785@0');
  const domainBytes = Buffer.from(domain);
  const frame = Buffer.concat([u32be(magic.length), magic, u32be(domainBytes.length), domainBytes, u32be(profile.length), profile, u64be(payload.length), payload]);
  return `aas:v0:sha256:${createHash('sha256').update(frame).digest('hex')}`;
};

/** Recompute any closed invocation artifact identity using its normative framed domain. */
export const computeBindingAasIdentity = (value) => computeFramedIdentity('aas.binding.v0', value);
export const computeBindingSetAasIdentity = (value) => computeFramedIdentity('aas.binding-set.v0', value);
export const computeTargetSelectionAasIdentity = (value) => computeFramedIdentity('aas.target-selection.v0', value);
export const computeOverlayAasIdentity = (value) => computeFramedIdentity('aas.overlay.v0', value);
export const computeAnalysisKeyAasIdentity = (value) => computeFramedIdentity('aas.analysis.v0', value);
export const computeProfileAasIdentity = (value) => computeFramedIdentity('aas.profile.v0', value);
export const computeEffectivePolicyAasIdentity = (value) => computeFramedIdentity('aas.policy.v0', value);
export const computeAnalyzerAasIdentity = (value) => computeFramedIdentity('aas.analyzer.v0', value);
export const computePromotionAasIdentity = (value) => computeFramedIdentity('aas.promotion.v0', value);
export const RESOURCE_ACCOUNTING_PROFILE_AAS_IDENTITY = 'aas:v0:sha256:aba07c457684cf217a74215a47e252aab23df9ed9242342a90167d6255365300';

/** Return the normative result identity projection, ignoring all duplicated wire identities. */
export function resultIdentityProjection(result) {
  const projection = structuredClone(result);
  delete projection.aasIdentity;
  for (const resolution of projection.resolutions ?? []) delete resolution.diagnostic?.resultAasIdentity;
  return projection;
}

/** Return the complete normative request identity projection. */
export function requestIdentityProjection(request) {
  const projection = structuredClone(request);
  delete projection.aasIdentity;
  return projection;
}

/** Return the exact normative aas.exception.v0 identity projection. */
export function exceptionIdentityProjection(exception) {
  const projection = structuredClone(exception);
  delete projection.aasIdentity;
  return projection;
}

/** Recompute the framed aas.exception.v0 identity from the normative projection. */
export function computeExceptionAasIdentity(exception) {
  return computeFramedIdentity('aas.exception.v0', exceptionIdentityProjection(exception));
}

/** Recompute the framed aas.request.v0 identity from the normative projection. */
export function computeRequestAasIdentity(request) {
  return computeFramedIdentity('aas.request.v0', request);
}

/** Recompute the framed aas.result.v0 identity from the normative projection. */
export function computeResultAasIdentity(result) {
  const payload = Buffer.from(canonicalize(resultIdentityProjection(result)), 'utf8');
  const magic = Buffer.from('AAS-ID');
  const domain = Buffer.from('aas.result.v0');
  const profile = Buffer.from('agent-architecture-canonical-json-rfc8785@0');
  const frame = Buffer.concat([u32be(magic.length), magic, u32be(domain.length), domain, u32be(profile.length), profile, u64be(payload.length), payload]);
  return `aas:v0:sha256:${createHash('sha256').update(frame).digest('hex')}`;
}

const sameJson = (left, right) => canonicalize(left) === canonicalize(right);
const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};
const exactSet = (values) => [...new Set(values)].sort();
const safeAdd = (sum, value) => {
  const next = sum + value;
  if (!Number.isSafeInteger(next)) throw new TypeError('invalid AAS aggregate: safe-integer overflow');
  return next;
};
const terminalTotal = (coverage) => terminalFields.reduce((sum, field) => safeAdd(sum, coverage[field]), 0);
const incompleteTotal = (coverage) => terminalFields.filter((field) => field !== 'included').reduce((sum, field) => safeAdd(sum, coverage[field]), 0);
const canonicalBytes = (value) => Buffer.byteLength(canonicalize(value), 'utf8');
const coverageWithoutStage = (coverage) => Object.fromEntries(Object.entries(coverage).filter(([key]) => key !== 'stage'));
const bindingCandidateProjection = (binding) => ({ id: binding.id, aasIdentity: binding.aasIdentity, policyAasIdentity: binding.policyAasIdentity });
// Audited against policy.schema.json#/$defs/binding: schemaVersion is constant;
// id/aasIdentity select the canonical representative; owner is presentation-only.
const bindingSemantics = (binding) => ({
  consumer: binding.consumer, repository: binding.repository, scope: binding.scope,
  pathProfile: binding.pathProfile, rolloutScope: binding.rolloutScope, mode: binding.mode, policyAasIdentity: binding.policyAasIdentity,
  profiles: binding.profiles, accountingProfile: binding.accountingProfile, budgets: binding.budgets,
  exceptions: binding.exceptions, promotionRecordAasIdentity: binding.promotionRecordAasIdentity
});
const compareAscii = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const pathContains = (parent, child) => child === parent || child.startsWith(`${parent}/`);
const bindingRank = (binding) => [binding.scope.subjectId === undefined ? 0 : 1,
  binding.scope.path === undefined ? 0 : binding.scope.path.split('/').length,
  binding.scope.ruleId === undefined ? 0 : 1];
const compareRank = (left, right) => {
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return right[index] - left[index];
  return 0;
};
const bindingApplies = (binding, coordinate) => binding.consumer === coordinate.consumer
  && binding.repository === coordinate.repository
  && sameJson(binding.pathProfile, coordinate.pathProfile)
  && pathContains(binding.scope.repositoryRoot, coordinate.path)
  && (binding.scope.subjectId === undefined || binding.scope.subjectId === coordinate.subjectId)
  && (binding.scope.path === undefined || pathContains(binding.scope.path, coordinate.path))
  && (binding.scope.ruleId === undefined || binding.scope.ruleId === coordinate.ruleId);
const rolloutDisposition = (binding, coordinate) => binding.rolloutScope === 'all' || coordinate.rolloutCohorts.includes(binding.rolloutScope) ? 'included' : 'excluded';

const deriveBindingDecision = (bindings, coordinate, fail) => {
  const applicable = bindings.filter((binding) => bindingApplies(binding, coordinate));
  applicable.sort((left, right) => compareRank(bindingRank(left), bindingRank(right)) || compareAscii(left.aasIdentity, right.aasIdentity));
  if (applicable.length === 0) return { decision: { state: 'absent', reason: 'binding-missing', candidateBindings: [] }, applicable };
  for (let index = 0; index < applicable.length;) {
    const rank = bindingRank(applicable[index]);
    const equalRank = applicable.filter((binding) => compareRank(bindingRank(binding), rank) === 0);
    if (equalRank.some((binding) => !sameJson(bindingSemantics(binding), bindingSemantics(equalRank[0])))) fail(`aas.problem.binding-set-conflict: ${coordinate.targetId}`);
    index += equalRank.length;
  }
  const topRank = bindingRank(applicable[0]);
  const tied = applicable.filter((binding) => compareRank(bindingRank(binding), topRank) === 0);
  const selected = tied[0];
  return { decision: { state: 'selected', selectedBindingId: selected.id, bindingAasIdentity: selected.aasIdentity,
    policyAasIdentity: selected.policyAasIdentity, candidateBindings: applicable.map(bindingCandidateProjection) }, applicable, selected,
    rolloutDisposition: rolloutDisposition(selected, coordinate) };
};

/** Derive the only valid wire selection from a complete identity-bound set and coordinate. */
export function deriveBindingSelection(bindingSet, coordinate) {
  const fail = (message) => { throw new TypeError(`invalid AAS binding set: ${message}`); };
  if (!bindingSet || computeBindingSetAasIdentity(bindingSet) !== bindingSet.aasIdentity) fail('binding-set aasIdentity mismatch');
  if (!coordinate || computeTargetSelectionAasIdentity(coordinate) !== coordinate.aasIdentity) fail('target-selection aasIdentity mismatch');
  for (const binding of bindingSet.bindings ?? []) if (computeBindingAasIdentity(binding) !== binding.aasIdentity) fail(`binding aasIdentity mismatch: ${binding.id}`);
  return deriveBindingDecision(bindingSet.bindings, coordinate, fail);
}

const assertBindingDecision = (decision, fail, label) => {
  if (!decision || !['selected', 'absent'].includes(decision.state) || !Array.isArray(decision.candidateBindings)) fail(`invalid binding decision: ${label}`);
  const ids = decision.candidateBindings.map(({ id }) => id);
  const identities = decision.candidateBindings.map(({ aasIdentity }) => aasIdentity);
  if (new Set(ids).size !== ids.length) fail(`duplicate candidate binding ID: ${label}`);
  if (new Set(identities).size !== identities.length) fail(`duplicate candidate binding identity: ${label}`);
  if (decision.state === 'absent') {
    if (decision.reason !== 'binding-missing' || decision.candidateBindings.length !== 0) fail(`absent binding decision must be binding-missing with an empty candidate set: ${label}`);
    return;
  }
  const selected = decision.candidateBindings.filter(({ id }) => id === decision.selectedBindingId);
  if (selected.length !== 1) fail(`selected binding must identify exactly one candidate: ${label}`);
  if (selected[0].aasIdentity !== decision.bindingAasIdentity || selected[0].policyAasIdentity !== decision.policyAasIdentity) fail(`selected binding/policy identity mismatch: ${label}`);
};

/** Length of a canonical request wire representation, useful only when those are the actual received bytes. */
export const canonicalRequestWireBytes = (request) => canonicalBytes(request);

/** Canonical result bytes charged to maxOutputBytes, including the final counter and self identities. */
export const canonicalResultOutputBytes = (result) => {
  const complete = structuredClone(result);
  let candidate = complete.realizedCounters?.outputBytes;
  if (!Number.isSafeInteger(candidate) || candidate < 0) throw new TypeError('invalid AAS result: outputBytes seed must be a safe nonnegative integer');
  for (let iteration = 0; iteration < 32; iteration += 1) {
    complete.realizedCounters.outputBytes = candidate;
    const next = canonicalBytes(complete);
    if (!Number.isSafeInteger(next)) throw new TypeError('invalid AAS result: outputBytes calculation overflow');
    if (next === candidate) return next;
    candidate = next;
  }
  throw new TypeError('invalid AAS result: outputBytes calculation did not converge');
};

/** Canonical bytes of the complete normative extension maps, including their scope. */
export const canonicalRequestExtensionBytes = (request) => canonicalBytes({
  request: { extensions: request.extensions, criticalExtensions: request.criticalExtensions },
  targets: request.targets.map(({ id, extensions, criticalExtensions }) => ({ id, extensions, criticalExtensions }))
});
const counterBudgets = Object.freeze({
  inputBytes: 'maxInputBytes', depth: 'maxDepth', pathSegments: 'maxPathSegments', pathBytes: 'maxPathBytes',
  entries: 'maxEntries', logicalBytes: 'maxLogicalBytes', readBytes: 'maxReadBytes', peakEntryBytes: 'maxPerEntryBytes',
  overlayOperations: 'maxOverlayOperations', targets: 'maxTargets', evidenceReferences: 'maxEvidenceReferences',
  extensionBytes: 'maxExtensionBytes', diagnostics: 'maxDiagnostics', outputBytes: 'maxOutputBytes',
  peakConcurrency: 'maxConcurrency', totalWork: 'maxTotalWork'
});

/** Cross-field result invariants that JSON Schema cannot express. */
export function assertResultInvariants(result, request, rawInputBytes) {
  const fail = (message) => { throw new TypeError(`invalid AAS result: ${message}`); };
  if (request !== undefined) assertRequestInvariants(request, rawInputBytes);
  if (!result || result.kind !== 'result') fail('result root required');
  if (computeResultAasIdentity(result) !== result.aasIdentity) fail('result aasIdentity does not match the normative projection');
  const stages = new Set();
  for (const coverage of result.coverage) {
    if (stages.has(coverage.stage)) fail(`duplicate coverage stage: ${coverage.stage}`);
    stages.add(coverage.stage);
    if (terminalTotal(coverage) !== coverage.denominator) fail(`inconsistent terminal coverage counts: ${coverage.stage}`);
  }
  const overlayApplicable = result.resolutions.some((item) => item.diagnostic?.overlayAasIdentity);
  if (overlayApplicable && !stages.has('overlay-reevaluation')) fail('applicable overlay reevaluation coverage is missing');
  if (!stages.has('evaluation')) fail('evaluation coverage is missing');
  const evaluation = result.coverage.find((item) => item.stage === 'evaluation');
  const resolutionIds = result.resolutions.map((item) => item.targetId);
  if (new Set(resolutionIds).size !== resolutionIds.length) fail('duplicate result target resolution');
  const resolutionByTarget = new Map(result.resolutions.map((item) => [item.targetId, item]));
  const evidenceIds = result.evidence.map((item) => item.id);
  if (new Set(evidenceIds).size !== evidenceIds.length) fail('duplicate evidence id');
  const evidenceIdSet = new Set(evidenceIds);
  const omissionKeys = new Set();
  for (const omission of result.omissions) {
    const key = `${omission.targetId}\u0000${omission.reason}`;
    if (omissionKeys.has(key)) fail(`duplicate omission bucket: ${omission.targetId}/${omission.reason}`);
    omissionKeys.add(key);
  }
  for (const resolution of result.resolutions) {
    const header = resolution.diagnostic;
    if (header.targetId !== resolution.targetId) fail(`resolution/header target mismatch: ${resolution.targetId}`);
    if (header.resolution !== resolution.resolution) fail(`resolution/header disposition mismatch: ${resolution.targetId}`);
    if ((resolution.resolution === 'stale') !== (header.freshness === 'stale')) fail(`resolution/freshness must be stale iff stale: ${resolution.targetId}`);
    assertBindingDecision(header.decisionTrace, fail, resolution.targetId);
    if (header.bindingState !== header.decisionTrace.state) fail(`header binding state/decision mismatch: ${resolution.targetId}`);
    if (header.bindingState === 'selected') {
      if (header.bindingAasIdentity !== header.decisionTrace.bindingAasIdentity || header.policyAasIdentity !== header.decisionTrace.policyAasIdentity) fail(`header binding/policy decision mismatch: ${resolution.targetId}`);
    } else if (resolution.resolution !== 'needs-input' || resolution.reason !== 'binding-missing') fail(`absent binding requires needs-input/binding-missing: ${resolution.targetId}`);
    if (resolution.resolution === 'decided') {
      if (resolution.verdict === undefined || header.verdict === undefined || resolution.verdict !== header.verdict) fail(`decided resolution requires one matching verdict: ${resolution.targetId}`);
    } else if (resolution.verdict !== undefined || header.verdict !== undefined) fail(`non-decided resolution forbids verdict: ${resolution.targetId}`);
    if (header.resultAasIdentity !== result.aasIdentity) fail(`result identity mismatch: ${resolution.targetId}`);
    if (header.requestAasIdentity !== result.requestAasIdentity) fail(`request identity mismatch: ${resolution.targetId}`);
    if (header.analysisKeyAasIdentity !== result.analysisKeyAasIdentity) fail(`analysis key mismatch: ${resolution.targetId}`);
    const targetStages = new Set();
    for (const coverage of resolution.coverage) {
      if (targetStages.has(coverage.stage)) fail(`duplicate target coverage stage: ${resolution.targetId}/${coverage.stage}`);
      targetStages.add(coverage.stage);
      if (terminalTotal(coverage) !== coverage.denominator) fail(`inconsistent target coverage counts: ${resolution.targetId}/${coverage.stage}`);
    }
    const targetEvaluation = resolution.coverage.find((item) => item.stage === 'evaluation');
    if (!targetEvaluation) fail(`target evaluation coverage is missing: ${resolution.targetId}`);
    if (!sameJson(header.coverageSummary, coverageWithoutStage(targetEvaluation))) fail(`header/target coverage mismatch: ${resolution.targetId}`);
    if (terminalTotal(header.coverageSummary) !== header.coverageSummary.denominator) fail(`inconsistent header terminal counts: ${resolution.targetId}`);
    if (resolution.resolution === 'decided') {
      if (incompleteTotal(targetEvaluation) !== 0) fail(`decided target requires complete evaluation coverage: ${resolution.targetId}`);
      const targetOverlay = resolution.coverage.find((item) => item.stage === 'overlay-reevaluation');
      if (header.overlayAasIdentity && (!targetOverlay || incompleteTotal(targetOverlay) !== 0)) fail(`decided target requires complete overlay coverage: ${resolution.targetId}`);
    }
    const severityTotal = Object.values(header.severityCounts).reduce(safeAdd, 0);
    const actualSeverityTotal = result.diagnostics.filter((item) => item.targetId === resolution.targetId).length;
    if (severityTotal !== actualSeverityTotal) fail(`inconsistent severity counts: ${resolution.targetId}`);
    const actualCounts = Object.fromEntries(severities.map((severity) => [severity, result.diagnostics.filter((item) => item.targetId === resolution.targetId && item.severity === severity).length]));
    if (!sameJson(header.severityCounts, actualCounts)) fail(`incorrect severity buckets: ${resolution.targetId}`);
    const expectedHighest = [...severities].reverse().find((severity) => actualCounts[severity] > 0) ?? 'none';
    if (header.highestSeverity !== expectedHighest) fail(`incorrect highest severity: ${resolution.targetId}`);
    const actualOmissions = result.omissions.filter((item) => item.targetId === resolution.targetId).reduce((sum, item) => safeAdd(sum, item.count), 0);
    if (header.omissionCount !== actualOmissions) fail(`inconsistent omission count: ${resolution.targetId}`);
    const reasons = exactSet(result.omissions.filter((item) => item.targetId === resolution.targetId).map((item) => item.reason));
    if (!sameJson(exactSet(header.omissionReasons), reasons)) fail(`inconsistent omission reasons: ${resolution.targetId}`);
  }
  for (const aggregate of result.coverage) {
    const components = result.resolutions.map((resolution) => resolution.coverage.find((item) => item.stage === aggregate.stage)).filter(Boolean);
    if (components.length === 0) fail(`global coverage stage has no target components: ${aggregate.stage}`);
    const expected = Object.fromEntries(['denominator', ...terminalFields].map((field) => [field, components.reduce((sum, item) => safeAdd(sum, item[field]), 0)]));
    if (!sameJson(coverageWithoutStage(aggregate), expected)) fail(`global coverage is not the exact target aggregate: ${aggregate.stage}`);
  }
  for (const resolution of result.resolutions) for (const coverage of resolution.coverage) if (!stages.has(coverage.stage)) fail(`target coverage stage absent from global aggregate: ${resolution.targetId}/${coverage.stage}`);
  if (result.omissions.some((item) => !resolutionIds.includes(item.targetId))) fail('omission refers to an unrequested target');
  if (result.diagnostics.some((item) => !resolutionIds.includes(item.targetId))) fail('diagnostic refers to an unrequested target');
  for (const diagnostic of result.diagnostics) {
    const header = resolutionByTarget.get(diagnostic.targetId)?.diagnostic;
    if (!header) fail(`diagnostic target has no unique resolution header: ${diagnostic.targetId}`);
    const trace = diagnostic.decisionTrace.bindingDecision;
    assertBindingDecision(trace, fail, `diagnostic/${diagnostic.targetId}`);
    if (!sameJson(trace, header.decisionTrace)) fail(`diagnostic trace/header binding decision mismatch: ${diagnostic.targetId}`);
    for (const id of diagnostic.evidenceIds) if (!evidenceIdSet.has(id)) fail(`unknown evidence reference: ${id}`);
  }
  if (result.realizedCounters.diagnostics !== result.diagnostics.length) fail('realized diagnostic count mismatch');
  if (result.realizedCounters.targets !== result.resolutions.length) fail('realized target count mismatch');
  const referenceCount = result.diagnostics.reduce((sum, item) => safeAdd(sum, item.evidenceIds.length), 0);
  if (result.realizedCounters.evidenceReferences !== referenceCount) fail('realized evidence-reference count mismatch');
  const expectedTotalWork = ['entries', 'logicalBytes', 'readBytes', 'overlayOperations', 'targets', 'evidenceReferences', 'extensionBytes', 'diagnostics']
    .reduce((sum, counter) => safeAdd(sum, result.realizedCounters[counter]), 0);
  if (!Number.isSafeInteger(expectedTotalWork) || result.realizedCounters.totalWork !== expectedTotalWork) fail('realized totalWork does not match the stable accounting formula');
  if (result.realizedCounters.outputBytes !== canonicalResultOutputBytes(result)) fail('realized outputBytes does not match canonical result accounting');
  if (request !== undefined) assertRequestResultInvariants(request, result, rawInputBytes);
  return result;
}

/** Validate the request/result bijection and operation-specific accounting jointly. */
export function assertRequestResultInvariants(request, result, rawInputBytes) {
  const fail = (message) => { throw new TypeError(`invalid AAS request/result pair: ${message}`); };
  assertRequestInvariants(request, rawInputBytes);
  const requestIds = request.targets.map((item) => item.id);
  if (!sameJson(requestIds, result.resolutions.map((item) => item.targetId))) fail('resolutions must form the exact ordered request-target bijection');
  if (request.aasIdentity !== result.requestAasIdentity) fail('result request identity mismatch');
  if (request.envelopeVersion !== result.envelopeVersion) fail('request/result envelope version mismatch');
  const targets = new Map(request.targets.map((target) => [target.id, target]));
  for (const resolution of result.resolutions) {
    const target = targets.get(resolution.targetId);
    const header = resolution.diagnostic;
    const duplicated = [
      ['snapshot', header.snapshotAasIdentity, request.snapshotAasIdentity],
      ['profile', header.profileAasIdentity, request.profileAasIdentity],
      ['analyzer', header.analyzerAasIdentity, request.analyzerAasIdentity],
      ['overlay', header.overlayAasIdentity, target.input.aasIdentity]
    ];
    for (const [name, actual, expected] of duplicated) if (actual !== expected) fail(`${name} identity mismatch: ${resolution.targetId}`);
    if (target.input.baseSnapshotAasIdentity !== request.snapshotAasIdentity) fail(`overlay baseSnapshot/request snapshot mismatch: ${resolution.targetId}`);
    assertBindingDecision(target.bindingSelection, fail, `request/${resolution.targetId}`);
    if (!sameJson(header.decisionTrace, target.bindingSelection)) fail(`result binding decision must exactly equal request-bound selection: ${resolution.targetId}`);
  }
  if (request.operation === 'validate-overlay@1') {
    for (const stage of ['evaluation', 'overlay-reevaluation']) {
      if (!result.coverage.some((item) => item.stage === stage)) fail(`operation-required coverage stage is missing: ${stage}`);
      for (const resolution of result.resolutions) if (!resolution.coverage.some((item) => item.stage === stage)) fail(`target operation-required coverage stage is missing: ${resolution.targetId}/${stage}`);
    }
    const operations = request.targets.reduce((sum, item) => safeAdd(sum, item.input.operations?.length ?? 0), 0);
    if (result.realizedCounters.overlayOperations !== operations) fail('realized overlay-operation count mismatch');
  }
  if (result.realizedCounters.targets !== request.targets.length) fail('realized request target count mismatch');
  if (result.realizedCounters.inputBytes !== rawInputBytes) fail('realized inputBytes does not match exact received request bytes');
  if (result.realizedCounters.extensionBytes !== canonicalRequestExtensionBytes(request)) fail('realized extensionBytes does not match canonical extension accounting');
  for (const [counter, budget] of Object.entries(counterBudgets)) if (result.realizedCounters[counter] > request.budgets[budget]) fail(`realized ${counter} exceeds request ${budget}`);
  const expectedDispositions = new Map();
  const addExtensions = (extensions, criticalExtensions, location, targetId) => {
    for (const [critical, values] of [[false, extensions], [true, criticalExtensions]]) for (const extensionId of Object.keys(values)) {
      const key = `${location}\u0000${targetId ?? ''}\u0000${extensionId}`;
      if (expectedDispositions.has(key)) fail(`extension appears in optional and critical maps: ${extensionId}`);
      expectedDispositions.set(key, { critical, extensionId, location, targetId });
    }
  };
  addExtensions(request.extensions, request.criticalExtensions, 'request');
  for (const target of request.targets) addExtensions(target.extensions, target.criticalExtensions, 'target', target.id);
  const actualDispositions = new Map();
  for (const disposition of result.extensionDispositions) {
    const key = `${disposition.location}\u0000${disposition.targetId ?? ''}\u0000${disposition.extensionId}`;
    if (actualDispositions.has(key)) fail(`duplicate extension disposition: ${disposition.extensionId}`);
    actualDispositions.set(key, disposition);
    const expected = expectedDispositions.get(key);
    if (!expected) fail(`invented or incorrectly scoped extension disposition: ${disposition.extensionId}`);
    if (expected.critical && disposition.disposition !== 'understood') fail(`critical extension was not understood in its declared scope: ${disposition.extensionId}`);
  }
  if (!sameJson([...actualDispositions.keys()].sort(), [...expectedDispositions.keys()].sort())) fail('extension dispositions must form the exact request/target/location/extension bijection');
  return result;
}

const validateBudgetSource = (source, label, fail) => {
  const budgetNames = exactSet(Object.values(counterBudgets));
  if (!source || !sameJson(exactSet(Object.keys(source)), budgetNames)) fail(`${label} must contain the exact closed budget field set`);
  for (const name of budgetNames) if (!Number.isSafeInteger(source[name]) || source[name] < 1) fail(`${label} has an invalid ${name}`);
};

/** Bounded iterative reduction; safe for the maximum 100,000-target invocation. */
export function deriveEffectiveBudgets(budgetSources) {
  const fail = (message) => { throw new TypeError(`invalid AAS budgets: ${message}`); };
  if (!Array.isArray(budgetSources) || budgetSources.length < 1 || budgetSources.length > 200002) fail('budget source count must be between 1 and 200002');
  const budgetNames = exactSet(Object.values(counterBudgets));
  for (const [index, source] of budgetSources.entries()) validateBudgetSource(source, `budget source ${index}`, fail);
  const effectiveBudgets = {};
  for (const name of budgetNames) {
    let minimum = Number.MAX_SAFE_INTEGER;
    for (const source of budgetSources) if (source[name] < minimum) minimum = source[name];
    effectiveBudgets[name] = minimum;
  }
  return effectiveBudgets;
}

const profileRef = ({ aasIdentity, id, definitionVersion }) => ({ version: definitionVersion, id, aasIdentity });
const mapAuthorizedArtifacts = (documents, allowed, computeIdentity, label, fail) => {
  if (!Array.isArray(documents) || !Array.isArray(allowed)) fail(`operator authority ${label} documents and allowlist are required`);
  const allowlist = new Set(allowed);
  if (allowlist.size !== allowed.length) fail(`duplicate operator-authorized ${label} identity`);
  const byIdentity = new Map();
  for (const document of documents) {
    if (!document?.aasIdentity || computeIdentity(document) !== document.aasIdentity) fail(`${label} artifact aasIdentity mismatch`);
    if (!allowlist.has(document.aasIdentity)) fail(`${label} artifact is not operator-authorized: ${document.aasIdentity}`);
    if (byIdentity.has(document.aasIdentity)) fail(`duplicate ${label} artifact identity`);
    byIdentity.set(document.aasIdentity, document);
  }
  if (byIdentity.size !== allowlist.size) fail(`${label} allowlist lacks an exact supplied document set`);
  return byIdentity;
};
const requireArtifact = (map, identity, label, fail) => {
  const artifact = map.get(identity);
  if (!artifact) fail(`${label} identity is not operator-authorized: ${identity}`);
  return artifact;
};
const sortedRefs = (profiles) => profiles.map(profileRef).sort((left, right) => compareAscii(left.aasIdentity, right.aasIdentity));
const sortedCompleteRefs = (references) => references.map((reference) => structuredClone(reference))
  .sort((left, right) => compareAscii(left.aasIdentity, right.aasIdentity));
const requireCompleteProfileRef = (reference, profiles, expectedKind, label, fail) => {
  const artifact = requireArtifact(profiles, reference?.aasIdentity, label, fail);
  if ((expectedKind && artifact.kind !== expectedKind) || !sameJson(reference, profileRef(artifact))) fail(`${label} ref does not match the complete verified ${expectedKind ? `${expectedKind} profile` : 'artifact'} ref: ${reference?.aasIdentity}`);
  return artifact;
};
const assertEffectivePolicy = (policy, profiles, fail, label) => {
  const ruleIds = policy.rules.map(({ id }) => id);
  if (new Set(ruleIds).size !== ruleIds.length) fail(`effective policy has duplicate rule IDs: ${label}`);
  const ruleIdSet = new Set(ruleIds);
  requireCompleteProfileRef(policy.pathProfile, profiles, 'path', 'effective policy path profile', fail);
  const policyIds = policy.profiles.map(({ aasIdentity }) => aasIdentity);
  if (new Set(policyIds).size !== policyIds.length) fail(`effective policy has duplicate profile identities: ${label}`);
  for (const reference of policy.profiles) requireCompleteProfileRef(reference, profiles, undefined, `effective policy profile: ${label}`, fail);
  const policyExceptionIds = policy.exceptions.map(({ aasIdentity }) => aasIdentity);
  if (new Set(policyExceptionIds).size !== policyExceptionIds.length) fail(`effective policy has duplicate exception identities: ${label}`);
  for (const exception of policy.exceptions) {
    if (computeExceptionAasIdentity(exception) !== exception.aasIdentity) fail(`embedded exception aasIdentity does not match the normative projection: ${label}/${exception.aasIdentity}`);
    if (!ruleIdSet.has(exception.ruleId)) fail(`embedded exception rule is absent from effective policy: ${label}/${exception.ruleId}`);
    if (!sameJson(exception.pathProfile, policy.pathProfile)) fail(`embedded exception path profile differs from effective policy: ${label}/${exception.aasIdentity}`);
  }
};
const assertPolicyForBinding = (policy, binding, profiles, accounting, fail) => {
  assertEffectivePolicy(policy, profiles, fail, binding.id);
  const ruleIds = new Set(policy.rules.map(({ id }) => id));
  if (binding.scope.ruleId !== undefined && !ruleIds.has(binding.scope.ruleId)) fail(`binding scope rule is absent from effective policy: ${binding.id}/${binding.scope.ruleId}`);
  const bindingIds = binding.profiles.map(({ aasIdentity }) => aasIdentity);
  if (new Set(bindingIds).size !== bindingIds.length) fail(`binding has duplicate profile identities: ${binding.id}`);
  if (!sameJson(sortedCompleteRefs(policy.profiles), sortedCompleteRefs(binding.profiles))) fail(`effective policy profile set does not agree with binding as complete refs: ${binding.id}`);
  for (const reference of binding.profiles) requireCompleteProfileRef(reference, profiles, undefined, `binding profile: ${binding.id}`, fail);
  if (!sameJson(binding.accountingProfile, profileRef(accounting))) fail(`accounting profile ref does not match the complete verified accounting profile ref: ${binding.id}`);
  const policyExceptionIds = policy.exceptions.map(({ aasIdentity }) => aasIdentity);
  if (new Set(binding.exceptions).size !== binding.exceptions.length) fail(`binding has duplicate exception identities: ${binding.id}`);
  if (!sameJson(exactSet(policyExceptionIds), exactSet(binding.exceptions))) fail(`effective policy exception identity set does not agree with binding: ${binding.id}`);
  if (policy.consumer !== binding.consumer || !sameJson(policy.pathProfile, binding.pathProfile)
    || policy.scope !== (binding.scope.path ?? binding.scope.repositoryRoot)) fail(`effective policy consumer, scope, or path profile does not agree with binding: ${binding.id}`);
};
const knownPathLowerBounds = (request, coordinates) => {
  let pathSegments = 0;
  let pathBytes = 0;
  for (const target of request.targets) {
    const paths = [coordinates[target.id].path, ...(target.input.operations ?? []).map(({ path }) => path)];
    for (const value of paths) {
      pathSegments = Math.max(pathSegments, value === '' ? 0 : value.split('/').length);
      pathBytes = Math.max(pathBytes, Buffer.byteLength(value, 'utf8'));
    }
  }
  return { pathSegments, pathBytes };
};
const assertKnownBudgets = (effectiveBudgets, request, coordinates, rawInputBytes, fail) => {
  const overlayOperations = request.targets.reduce((sum, target) => safeAdd(sum, target.input.operations?.length ?? 0), 0);
  const extensionBytes = canonicalRequestExtensionBytes(request);
  const known = { inputBytes: rawInputBytes, targets: request.targets.length, overlayOperations, extensionBytes,
    ...knownPathLowerBounds(request, coordinates) };
  known.totalWork = safeAdd(safeAdd(known.targets, known.overlayOperations), known.extensionBytes);
  for (const [counter, value] of Object.entries(known)) if (value > effectiveBudgets[counterBudgets[counter]]) fail(`known ${counter} lower bound exceeds effective ${counterBudgets[counter]}`);
};
const exactKeys = (value, keys, label, fail) => {
  if (!value || typeof value !== 'object' || !sameJson(Object.keys(value).sort(), [...keys].sort())) fail(`${label} must contain the exact trusted field set`);
};
const parseAuthorityCollection = (values, definition, label, limits, fail) => {
  if (!Array.isArray(values)) fail(`${label} must be a raw-byte collection`);
  return values.map((bytes, index) => parseSchemaBytes(bytes, definition, `${label}[${index}]`, limits).parsed);
};
const assertProfileGraph = (profiles, fail) => {
  const visiting = new Set(), complete = new Set();
  const visit = (profile) => {
    if (visiting.has(profile.aasIdentity)) fail(`cyclic profile dependency: ${profile.aasIdentity}`);
    if (complete.has(profile.aasIdentity)) return;
    visiting.add(profile.aasIdentity);
    const dependencyIds = new Set();
    for (const reference of profile.dependencies) {
      if (dependencyIds.has(reference.aasIdentity)) fail(`duplicate profile dependency: ${profile.aasIdentity}/${reference.aasIdentity}`);
      dependencyIds.add(reference.aasIdentity);
      visit(requireCompleteProfileRef(reference, profiles, undefined, `profile dependency: ${profile.id}`, fail));
    }
    visiting.delete(profile.aasIdentity); complete.add(profile.aasIdentity);
  };
  for (const profile of profiles.values()) visit(profile);
};
const assertPromotionForBinding = (binding, promotions, qualifiedPromotions, fail) => {
  if (binding.mode === 'shadow') return;
  const promotion = requireArtifact(promotions, binding.promotionRecordAasIdentity, 'promotion record', fail);
  if (!qualifiedPromotions.has(promotion.aasIdentity)) fail(`promotion record is not locally qualified: ${promotion.aasIdentity}`);
  const expectedPrevious = binding.mode === 'advisory' ? 'shadow' : 'advisory';
  if (binding.scope.ruleId === undefined || promotion.ruleId !== binding.scope.ruleId || promotion.consumer !== binding.consumer
    || promotion.policy !== binding.policyAasIdentity || !sameJson(sortedCompleteRefs(promotion.profiles), sortedCompleteRefs(binding.profiles))
    || promotion.rolloutScope !== binding.rolloutScope || promotion.previousMode !== expectedPrevious || promotion.nextMode !== binding.mode) {
    fail(`promotion record does not exactly authorize binding transition: ${binding.id}`);
  }
};
const bindingIndexKey = ({ consumer, repository, pathProfile }) => `${consumer}\u0000${repository}\u0000${pathProfile.aasIdentity}`;
const createBindingTrieNode = () => ({ bindings: [], children: new Map() });
const buildBindingIndex = (bindings) => {
  const index = new Map();
  for (const binding of bindings) {
    const key = bindingIndexKey(binding), root = index.get(key) ?? createBindingTrieNode();
    const prefix = binding.scope.path ?? binding.scope.repositoryRoot;
    let node = root;
    for (const segment of prefix.split('/')) {
      const child = node.children.get(segment) ?? createBindingTrieNode();
      node.children.set(segment, child); node = child;
    }
    node.bindings.push(binding); index.set(key, root);
  }
  return index;
};
const queryBindingIndex = (index, coordinate) => {
  let node = index.get(bindingIndexKey(coordinate));
  if (!node) return [];
  const candidates = [...node.bindings];
  for (const segment of coordinate.path.split('/')) {
    node = node.children.get(segment);
    if (!node) break;
    candidates.push(...node.bindings);
  }
  return candidates;
};
const pathBounds = (paths) => paths.reduce((known, value) => ({
  pathSegments: Math.max(known.pathSegments, value.split('/').length),
  pathBytes: Math.max(known.pathBytes, Buffer.byteLength(value, 'utf8'))
}), { pathSegments: 0, pathBytes: 0 });
const rawRequestLowerBounds = (request, rawInputBytes) => {
  const overlayOperations = request.targets.reduce((sum, target) => safeAdd(sum, target.input.operations.length), 0);
  const extensionBytes = canonicalRequestExtensionBytes(request);
  return {
    inputBytes: rawInputBytes,
    targets: request.targets.length,
    overlayOperations,
    extensionBytes,
    ...pathBounds(request.targets.flatMap(({ input }) => input.operations.map(({ path }) => path))),
    totalWork: safeAdd(safeAdd(request.targets.length, overlayOperations), extensionBytes)
  };
};
const assertLowerBounds = (effectiveBudgets, lowerBounds, fail) => {
  for (const [counter, value] of Object.entries(lowerBounds)) {
    if (value > effectiveBudgets[counterBudgets[counter]]) fail(`known ${counter} lower bound exceeds effective ${counterBudgets[counter]}`);
  }
};

/** Create the one trusted, synchronous invocation authority boundary. */
export function createInvocationKernel({ operatorAuthority, targetAuthority, providerBudgets, ingressLimits } = {}) {
  const fail = (message) => { throw new TypeError(`invalid AAS invocation kernel: ${message}`); };
  const limits = ingressLimits === undefined ? { maxBytes: 67_108_864, maxDepth: 128 } : structuredClone(ingressLimits);
  exactKeys(limits, ['maxBytes', 'maxDepth'], 'ingressLimits', fail);
  if (!Number.isSafeInteger(limits.maxBytes) || limits.maxBytes < 1 || !Number.isSafeInteger(limits.maxDepth) || limits.maxDepth < 1) fail('invalid ingressLimits');
  const trustedBudgets = structuredClone(providerBudgets); validateBudgetSource(trustedBudgets, 'providerBudgets', fail);
  const authorityKeys = ['namespace', 'bindingSet', 'effectivePolicies', 'allowedPolicyAasIdentities', 'profiles', 'allowedProfileAasIdentities',
    'analyzers', 'allowedAnalyzerAasIdentities', 'promotionRecords', 'allowedPromotionRecordAasIdentities', 'qualifiedPromotionRecordAasIdentities'];
  exactKeys(operatorAuthority, authorityKeys, 'operatorAuthority', fail);
  if (typeof operatorAuthority.namespace !== 'string' || operatorAuthority.namespace.length === 0) fail('operatorAuthority namespace is required');
  const bindingSet = parseSchemaBytes(operatorAuthority.bindingSet, 'bindingSet', 'binding set', limits).parsed;
  for (const [index, binding] of bindingSet.bindings.entries()) assertSchema(binding, 'binding', `binding set member ${index}`);
  if (computeBindingSetAasIdentity(bindingSet) !== bindingSet.aasIdentity) fail('binding-set aasIdentity mismatch');
  const bindings = bindingSet.bindings;
  for (const binding of bindings) {
    if (computeBindingAasIdentity(binding) !== binding.aasIdentity) fail(`binding aasIdentity mismatch: ${binding.id}`);
    assertIdentityDocumentPathInvariants(binding, `binding ${binding.id}`);
  }
  if (new Set(bindings.map(({ id }) => id)).size !== bindings.length || new Set(bindings.map(({ aasIdentity }) => aasIdentity)).size !== bindings.length) fail('duplicate binding member ID or identity');
  const policyDocuments = parseAuthorityCollection(operatorAuthority.effectivePolicies, 'effectivePolicy', 'effective policies', limits, fail);
  const profileDocuments = parseAuthorityCollection(operatorAuthority.profiles, 'profile', 'profiles', limits, fail);
  const analyzerDocuments = parseAuthorityCollection(operatorAuthority.analyzers, 'analyzer', 'analyzers', limits, fail);
  const promotionDocuments = parseAuthorityCollection(operatorAuthority.promotionRecords, 'promotionRecord', 'promotion records', limits, fail);
  const policies = mapAuthorizedArtifacts(policyDocuments, structuredClone(operatorAuthority.allowedPolicyAasIdentities), computeEffectivePolicyAasIdentity, 'effective policy', fail);
  const profiles = mapAuthorizedArtifacts(profileDocuments, structuredClone(operatorAuthority.allowedProfileAasIdentities), computeProfileAasIdentity, 'profile', fail);
  const analyzers = mapAuthorizedArtifacts(analyzerDocuments, structuredClone(operatorAuthority.allowedAnalyzerAasIdentities), computeAnalyzerAasIdentity, 'analyzer', fail);
  const promotions = mapAuthorizedArtifacts(promotionDocuments, structuredClone(operatorAuthority.allowedPromotionRecordAasIdentities), computePromotionAasIdentity, 'promotion record', fail);
  const qualifiedList = structuredClone(operatorAuthority.qualifiedPromotionRecordAasIdentities);
  if (!Array.isArray(qualifiedList) || new Set(qualifiedList).size !== qualifiedList.length) fail('qualified promotion projection must be an exact duplicate-free allowlist');
  const qualifiedPromotions = new Set(qualifiedList);
  for (const identity of qualifiedPromotions) requireArtifact(promotions, identity, 'qualified promotion record', fail);
  const accounting = requireArtifact(profiles, RESOURCE_ACCOUNTING_PROFILE_AAS_IDENTITY, 'registered accounting profile', fail);
  if (accounting.kind !== 'accounting') fail('registered accounting profile has the wrong kind');
  assertProfileGraph(profiles, fail);
  for (const policy of policies.values()) { assertIdentityDocumentPathInvariants(policy, `effective policy ${policy.aasIdentity}`); assertEffectivePolicy(policy, profiles, fail, policy.aasIdentity); }
  for (const binding of bindings) {
    assertPolicyForBinding(requireArtifact(policies, binding.policyAasIdentity, 'effective policy', fail), binding, profiles, accounting, fail);
    assertPromotionForBinding(binding, promotions, qualifiedPromotions, fail);
  }
  for (const analyzer of analyzers.values()) {
    const identities = analyzer.profiles.map(({ aasIdentity }) => aasIdentity);
    if (new Set(identities).size !== identities.length) fail(`analyzer has duplicate evaluator profile identities: ${analyzer.aasIdentity}`);
    for (const reference of analyzer.profiles) requireCompleteProfileRef(reference, profiles, 'evaluator', 'analyzer evaluator profile', fail);
  }
  for (const promotion of promotions.values()) {
    const profileIds = promotion.profiles.map(({ aasIdentity }) => aasIdentity);
    if (new Set(profileIds).size !== profileIds.length) fail(`promotion record has duplicate profile identities: ${promotion.aasIdentity}`);
    for (const reference of promotion.profiles) requireCompleteProfileRef(reference, profiles, undefined, 'promotion profile', fail);
    requireArtifact(analyzers, promotion.analyzerAasIdentity, 'promotion analyzer', fail);
    const expectedPrevious = promotion.nextMode === 'advisory' ? 'shadow' : 'advisory';
    if (promotion.previousMode !== expectedPrevious) fail(`promotion record transition is not adjacent: ${promotion.aasIdentity}`);
  }
  exactKeys(targetAuthority, ['resolve', 'integrationContext'], 'targetAuthority', fail);
  if (typeof targetAuthority.resolve !== 'function') fail('targetAuthority.resolve must be a function');
  const resolveTargetSelection = targetAuthority.resolve;
  let integrationContext;
  try { integrationContext = deepFreeze(structuredClone(targetAuthority.integrationContext)); }
  catch { fail('targetAuthority integrationContext must be cloneable'); }
  const admitted = deepFreeze(structuredClone({ namespace: operatorAuthority.namespace, bindings, policies: [...policies.values()],
    profiles: [...profiles.values()], analyzers: [...analyzers.values()], promotions: [...promotions.values()], trustedBudgets }));
  const bindingIndex = buildBindingIndex(admitted.bindings);
  const capabilities = new WeakMap();

  const preflightInvocation = function (rawRequestBytes) {
    if (arguments.length !== 1) fail('preflight accepts only raw request bytes');
    const wire = parseSchemaBytes(rawRequestBytes, 'request', 'request', limits);
    const request = wire.parsed; assertIdentityDocumentPathInvariants(request, 'request'); assertRequestInvariants(request, wire.byteLength);
    const requestOperation = requireArtifact(profiles, request.profileAasIdentity, 'operation profile', fail);
    if (requestOperation.kind !== 'operation') fail('request operation profile has the wrong kind');
    const analyzer = requireArtifact(analyzers, request.analyzerAasIdentity, 'analyzer', fail);
    if (request.accountingProfileAasIdentity !== accounting.aasIdentity) fail('request accounting profile is not the registered artifact');
    for (const target of request.targets) if (computeOverlayAasIdentity(target.input) !== target.input.aasIdentity) fail(`overlay aasIdentity mismatch: ${target.id}`);
    const provisionalSources = [request.budgets, trustedBudgets, ...request.targets.map(({ input }) => input.limits)];
    const provisionalBudgets = deriveEffectiveBudgets(provisionalSources);
    const overlayPaths = request.targets.flatMap(({ input }) => input.operations.map(({ path }) => path));
    assertLowerBounds(provisionalBudgets, rawRequestLowerBounds(request, wire.byteLength), fail);
    const correlation = deepFreeze(structuredClone({ requestAasIdentity: request.aasIdentity,
      targets: request.targets.map(({ id, input }) => ({ id, inputAasIdentity: input.aasIdentity, pathProfile: input.pathProfile })) }));
    let returned;
    try { returned = structuredClone(Reflect.apply(resolveTargetSelection, undefined, [correlation, integrationContext])); }
    catch (error) { fail(`targetAuthority.resolve failed closed: ${error instanceof Error ? error.message : 'uncloneable result'}`); }
    if (!returned || typeof returned !== 'object' || Array.isArray(returned)) fail('resolver must return target selections keyed by target ID');
    const requestKeys = request.targets.map(({ id }) => id).sort();
    if (!sameJson(Object.keys(returned).sort(), requestKeys)) fail('resolver target-selection keys must exactly equal request target keys');
    const budgetSources = [...provisionalSources], selectedByTarget = {}, policiesByTarget = {}, rolloutByTarget = {}, coordinates = {};
    let requiredOperation = profileRef(requestOperation), requiredEvaluators;
    const examinedPaths = [...overlayPaths];
    for (const target of request.targets) {
      const coordinate = returned[target.id]; assertSchema(coordinate, 'targetSelection', `target selection ${target.id}`); assertPortablePath(coordinate.path);
      if (coordinate.targetId !== target.id || computeTargetSelectionAasIdentity(coordinate) !== coordinate.aasIdentity) fail(`target-selection identity mismatch: ${target.id}`);
      if (coordinate.aasIdentity !== target.targetSelectionAasIdentity) fail(`target-selection identity does not equal request-bound identity: ${target.id}`);
      if (!sameJson(coordinate.pathProfile, target.input.pathProfile)) fail(`target-selection and overlay path-profile mismatch: ${target.id}`);
      const pathProfile = requireCompleteProfileRef(coordinate.pathProfile, profiles, 'path', 'target-selection path profile', fail);
      void pathProfile; coordinates[target.id] = coordinate; examinedPaths.push(coordinate.path);
      const derived = deriveBindingDecision(queryBindingIndex(bindingIndex, coordinate), coordinate, fail);
      for (const binding of derived.applicable) examinedPaths.push(binding.scope.repositoryRoot, ...(binding.scope.path ? [binding.scope.path] : []));
      if (!sameJson(derived.decision, target.bindingSelection)) fail(`request binding selection is not the complete authoritative-catalog derivation: ${target.id}`);
      rolloutByTarget[target.id] = derived.selected ? derived.rolloutDisposition : 'not-applicable';
      if (derived.selected) {
        const policy = requireArtifact(policies, derived.selected.policyAasIdentity, 'effective policy', fail);
        examinedPaths.push(policy.scope, ...policy.exceptions.map(({ scope }) => scope));
        const promotion = derived.selected.mode === 'shadow' ? undefined : requireArtifact(promotions, derived.selected.promotionRecordAasIdentity, 'promotion record', fail);
        if (promotion && promotion.analyzerAasIdentity !== analyzer.aasIdentity) fail(`promotion analyzer does not equal verified request analyzer: ${target.id}`);
        const selectedProfiles = derived.selected.profiles.map((reference) => requireCompleteProfileRef(reference, profiles, undefined, 'selected profile', fail));
        const operations = selectedProfiles.filter(({ kind }) => kind === 'operation');
        const evaluators = sortedRefs(selectedProfiles.filter(({ kind }) => kind === 'evaluator'));
        if (operations.length !== 1 || evaluators.length === 0) fail(`binding must select one operation and evaluators: ${target.id}`);
        const operation = profileRef(operations[0]);
        if (!sameJson(operation, requiredOperation) || (requiredEvaluators && !sameJson(evaluators, requiredEvaluators))) fail('heterogeneous selected profile sets');
        requiredEvaluators = evaluators;
        budgetSources.push(derived.selected.budgets); selectedByTarget[target.id] = derived.selected; policiesByTarget[target.id] = policy;
      }
    }
    const analyzerProfiles = new Map(analyzer.profiles.map((reference) => [reference.aasIdentity, reference]));
    for (const evaluator of requiredEvaluators ?? []) if (!sameJson(analyzerProfiles.get(evaluator.aasIdentity), evaluator)) fail(`analyzer does not support evaluator: ${evaluator.aasIdentity}`);
    const semanticExtensions = { request: request.extensions, criticalRequest: request.criticalExtensions,
      targets: request.targets.map(({ id, extensions, criticalExtensions }) => ({ id, extensions, criticalExtensions })) };
    const effectiveBudgets = deriveEffectiveBudgets(budgetSources), lowerBounds = { ...pathBounds(examinedPaths) };
    const analysisKey = { aasIdentity: '', operationProfile: requiredOperation, evaluatorProfiles: requiredEvaluators ?? [],
      inputAasIdentities: [request.snapshotAasIdentity, ...request.targets.map(({ input }) => input.aasIdentity)], budgets: effectiveBudgets,
      accountingProfile: profileRef(accounting), semanticExtensions, requestAasIdentity: request.aasIdentity, operation: request.operation,
      profileAasIdentity: request.profileAasIdentity, analyzerAasIdentity: analyzer.aasIdentity, snapshotAasIdentity: request.snapshotAasIdentity };
    analysisKey.aasIdentity = computeAnalysisKeyAasIdentity(analysisKey); assertSchema(analysisKey, 'analysisKey', 'derived analysis key');
    assertKnownBudgets(effectiveBudgets, request, coordinates, wire.byteLength, fail);
    assertLowerBounds(effectiveBudgets, lowerBounds, fail);
    const state = deepFreeze(structuredClone({ request, analysisKey, effectiveBudgets, selectedByTarget, policiesByTarget, rolloutByTarget,
      rawInputBytes: wire.byteLength, lowerBounds, analyzer, operationProfile: requiredOperation, evaluatorProfiles: requiredEvaluators ?? [] }));
    const capability = Object.freeze(Object.create(null)); capabilities.set(capability, state);
    const plan = deepFreeze(structuredClone({ request: state.request, analysisKey: state.analysisKey, effectiveBudgets: state.effectiveBudgets,
      selectedByTarget: state.selectedByTarget, policiesByTarget: state.policiesByTarget, rolloutByTarget: state.rolloutByTarget,
      analyzer: state.analyzer, operationProfile: state.operationProfile, evaluatorProfiles: state.evaluatorProfiles }));
    return deepFreeze({ capability, plan });
  };

  const reconcileInvocationResult = function (capability, rawResultBytes) {
    if (arguments.length !== 2) fail('reconciliation accepts only a capability and raw result bytes');
    const state = capabilities.get(capability);
    if (!state) fail('authentic per-kernel preflight capability is required');
    const result = parseSchemaBytes(rawResultBytes, 'result', 'result', limits).parsed;
    assertResultInvariants(result, state.request, state.rawInputBytes);
    if (result.analysisKeyAasIdentity !== state.analysisKey.aasIdentity) fail('analysis key identity mismatch');
    for (const target of state.request.targets) {
      const resolution = result.resolutions.find(({ targetId }) => targetId === target.id), selected = state.selectedByTarget[target.id];
      if (selected && resolution.diagnostic.mode !== selected.mode) fail(`selected binding mode mismatch: ${target.id}`);
      if (resolution.diagnostic.rolloutDisposition !== state.rolloutByTarget[target.id]) fail(`binding rollout disposition mismatch: ${target.id}`);
    }
    for (const [counter, budget] of Object.entries(counterBudgets)) if (result.realizedCounters[counter] > state.effectiveBudgets[budget]) fail(`realized ${counter} exceeds componentwise-minimum effective ${budget}`);
    for (const counter of ['pathSegments', 'pathBytes']) if (result.realizedCounters[counter] < state.lowerBounds[counter]) fail(`realized ${counter} underreports preflight lower bound`);
    return deepFreeze(structuredClone(result));
  };
  Object.freeze(preflightInvocation); Object.freeze(reconcileInvocationResult);
  return deepFreeze({ preflightInvocation, reconcileInvocationResult });
}

/** Validate request-only invariants before any evaluation begins. */
export function assertRequestInvariants(request, rawInputBytes) {
  const fail = (message) => { throw new TypeError(`invalid AAS request: ${message}`); };
  if (!request || request.kind !== 'request') fail('request root required');
  if (!Number.isSafeInteger(rawInputBytes) || rawInputBytes < 0) fail('exact received request byte length is required');
  if (computeRequestAasIdentity(request) !== request.aasIdentity) fail('request aasIdentity does not match the normative projection');
  const ids = request.targets.map((item) => item.id);
  if (new Set(ids).size !== ids.length) fail('duplicate request target id');
  for (const target of request.targets) assertBindingDecision(target.bindingSelection, fail, `request/${target.id}`);
  const extensionCount = Object.keys(request.extensions).length + Object.keys(request.criticalExtensions).length
    + request.targets.reduce((sum, target) => sum + Object.keys(target.extensions).length + Object.keys(target.criticalExtensions).length, 0);
  if (extensionCount > 128) fail('aggregate request extension disposition demand exceeds 128');
  if (rawInputBytes > request.budgets.maxInputBytes) fail('exact received request bytes exceed maxInputBytes');
  if (canonicalRequestExtensionBytes(request) > request.budgets.maxExtensionBytes) fail('canonical extension maps exceed maxExtensionBytes');
  return request;
}
