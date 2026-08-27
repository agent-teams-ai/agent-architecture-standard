import { createHash } from 'node:crypto';

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
const assertPolicyForBinding = (policy, binding, profiles, fail) => {
  const ruleIds = policy.rules.map(({ id }) => id);
  if (new Set(ruleIds).size !== ruleIds.length) fail(`effective policy has duplicate rule IDs: ${binding.id}`);
  const policyIds = policy.profiles.map(({ aasIdentity }) => aasIdentity);
  if (new Set(policyIds).size !== policyIds.length) fail(`effective policy has duplicate profile identities: ${binding.id}`);
  if (!sameJson(exactSet(policyIds), exactSet(binding.profiles.map(({ aasIdentity }) => aasIdentity)))) fail(`effective policy profile set does not agree with binding: ${binding.id}`);
  for (const identity of policyIds) requireArtifact(profiles, identity, 'profile', fail);
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
const preflightCapabilities = new WeakSet();

/** Trusted local verifier state is accepted only here; it is never request or identity content. */
export function preflightInvocation({ request, result: _result, analysisKey, targetSelectionsByTarget, operatorAuthority, ...unexpected }, rawInputBytes) {
  const fail = (message) => { throw new TypeError(`invalid AAS invocation: ${message}`); };
  assertRequestInvariants(request, rawInputBytes);
  if (Object.keys(unexpected).length !== 0) fail('caller-selected binding or applicability authority is forbidden');
  if (!analysisKey || !targetSelectionsByTarget || typeof targetSelectionsByTarget !== 'object' || !operatorAuthority || typeof operatorAuthority !== 'object') fail('analysis key, target selections, and private operator authority are required');
  if (computeAnalysisKeyAasIdentity(analysisKey) !== analysisKey.aasIdentity) fail('analysis key aasIdentity does not match the normative projection');
  const bindings = operatorAuthority.bindings;
  if (!operatorAuthority.namespace || !Array.isArray(bindings) || bindings.length > 10000) fail('operator authority requires a bounded complete namespaced binding catalog');
  for (const binding of bindings) if (computeBindingAasIdentity(binding) !== binding.aasIdentity) fail(`binding aasIdentity does not match the normative projection: ${binding.id}`);
  if (new Set(bindings.map(({ aasIdentity }) => aasIdentity)).size !== bindings.length || new Set(bindings.map(({ id }) => id)).size !== bindings.length) fail('duplicate authority binding member ID or identity');
  const policies = mapAuthorizedArtifacts(operatorAuthority.effectivePolicies, operatorAuthority.allowedPolicyAasIdentities, computeEffectivePolicyAasIdentity, 'effective policy', fail);
  for (const policy of policies.values()) if (new Set(policy.rules.map(({ id }) => id)).size !== policy.rules.length) fail('effective policy has duplicate rule IDs');
  const profiles = mapAuthorizedArtifacts(operatorAuthority.profiles, operatorAuthority.allowedProfileAasIdentities, computeProfileAasIdentity, 'profile', fail);
  const analyzers = mapAuthorizedArtifacts(operatorAuthority.analyzers, operatorAuthority.allowedAnalyzerAasIdentities, computeAnalyzerAasIdentity, 'analyzer', fail);
  const profileKinds = new Set(['canonicalization', 'operation', 'vocabulary', 'evaluator', 'security', 'path', 'diagnostic', 'accounting']);
  for (const profile of profiles.values()) if (!profileKinds.has(profile.kind) || !profile.id || !profile.definitionVersion
    || !Array.isArray(profile.schemas) || profile.schemas.length === 0 || !Array.isArray(profile.dependencies)
    || !Array.isArray(profile.semanticsArtifacts) || profile.semanticsArtifacts.length === 0
    || !Array.isArray(profile.definitionVectorSuites) || profile.definitionVectorSuites.length === 0) fail(`invalid authorized profile artifact shape: ${profile.aasIdentity}`);
  for (const analyzerDocument of analyzers.values()) if (!Array.isArray(analyzerDocument.implementationArtifacts)
    || analyzerDocument.implementationArtifacts.length === 0 || !Array.isArray(analyzerDocument.configuration)
    || !Array.isArray(analyzerDocument.profiles) || analyzerDocument.profiles.length === 0) fail(`invalid authorized analyzer artifact shape: ${analyzerDocument.aasIdentity}`);
  const requestKeys = request.targets.map(({ id }) => id).sort();
  if (!sameJson(Object.keys(targetSelectionsByTarget).sort(), requestKeys)) fail('target selection keys must exactly equal request target keys');
  const accounting = requireArtifact(profiles, request.accountingProfileAasIdentity, 'accounting profile', fail);
  if (accounting.kind !== 'accounting' || request.accountingProfileAasIdentity !== RESOURCE_ACCOUNTING_PROFILE_AAS_IDENTITY) fail('accounting profile is not the authoritative registered artifact');
  const analyzer = requireArtifact(analyzers, request.analyzerAasIdentity, 'analyzer', fail);
  const requestOperation = requireArtifact(profiles, request.profileAasIdentity, 'operation profile', fail);
  if (requestOperation.kind !== 'operation') fail('request operation profile is not a verified kind=operation artifact');
  const budgetSources = [request.budgets, analysisKey.budgets];
  const selectedByTarget = {};
  const policiesByTarget = {};
  const rolloutByTarget = {};
  const coordinates = {};
  let requiredOperation = profileRef(requestOperation);
  let requiredEvaluators;
  for (const target of request.targets) {
    if (computeOverlayAasIdentity(target.input) !== target.input.aasIdentity) fail(`overlay aasIdentity does not match the normative projection: ${target.id}`);
    const coordinate = targetSelectionsByTarget[target.id];
    if (!coordinate || coordinate.targetId !== target.id || computeTargetSelectionAasIdentity(coordinate) !== coordinate.aasIdentity) fail(`target-selection identity mismatch: ${target.id}`);
    if (coordinate.aasIdentity !== target.targetSelectionAasIdentity) fail(`target-selection identity does not equal request-bound identity: ${target.id}`);
    if (!sameJson(coordinate.pathProfile, target.input.pathProfile)) fail(`target-selection and overlay path-profile mismatch: ${target.id}`);
    const pathProfile = requireArtifact(profiles, coordinate.pathProfile.aasIdentity, 'path profile', fail);
    if (pathProfile.kind !== 'path' || !sameJson(profileRef(pathProfile), coordinate.pathProfile)) fail(`verified path profile does not match target selection: ${target.id}`);
    coordinates[target.id] = coordinate;
    const derived = deriveBindingDecision(bindings, coordinate, fail);
    if (!sameJson(derived.decision, target.bindingSelection)) fail(`request binding selection is not the complete authoritative-catalog derivation: ${target.id}`);
    rolloutByTarget[target.id] = derived.selected ? derived.rolloutDisposition : 'not-applicable';
    if (derived.selected) {
      const policy = requireArtifact(policies, derived.selected.policyAasIdentity, 'effective policy', fail);
      assertPolicyForBinding(policy, derived.selected, profiles, fail);
      if (derived.selected.accountingProfile?.aasIdentity !== accounting.aasIdentity) fail(`accounting profile substitution in binding: ${target.id}/${derived.selected.id}`);
      const selectedProfiles = derived.selected.profiles.map(({ aasIdentity }) => requireArtifact(profiles, aasIdentity, 'profile', fail));
      const operations = selectedProfiles.filter(({ kind }) => kind === 'operation');
      const evaluators = sortedRefs(selectedProfiles.filter(({ kind }) => kind === 'evaluator'));
      if (operations.length !== 1 || evaluators.length === 0) fail(`binding/policy must select exactly one operation and at least one evaluator profile: ${target.id}`);
      const operation = profileRef(operations[0]);
      if (operation.aasIdentity !== request.profileAasIdentity) fail(`request operation profile is not the verified selected operation artifact: ${target.id}`);
      if (!sameJson(requiredOperation, operation)) fail('heterogeneous operation profile sets across selected bindings');
      if (requiredEvaluators && !sameJson(requiredEvaluators, evaluators)) fail('heterogeneous evaluator profile sets across selected bindings');
      requiredOperation = operation; requiredEvaluators = evaluators;
      budgetSources.push(derived.selected.budgets);
      selectedByTarget[target.id] = derived.selected;
      policiesByTarget[target.id] = policy;
    }
    budgetSources.push(target.input.limits);
  }
  const analyzerProfiles = new Set(analyzer.profiles.map(({ aasIdentity }) => aasIdentity));
  for (const evaluator of requiredEvaluators ?? []) if (!analyzerProfiles.has(evaluator.aasIdentity)) fail(`analyzer does not support evaluator profile: ${evaluator.aasIdentity}`);
  const semanticExtensions = { request: request.extensions, criticalRequest: request.criticalExtensions,
    targets: request.targets.map(({ id, extensions, criticalExtensions }) => ({ id, extensions, criticalExtensions })) };
  const expectedAnalysis = { aasIdentity: analysisKey.aasIdentity, operationProfile: requiredOperation, evaluatorProfiles: requiredEvaluators ?? [],
    inputAasIdentities: [request.snapshotAasIdentity, ...request.targets.map((target) => target.input.aasIdentity)], budgets: analysisKey.budgets,
    accountingProfile: profileRef(accounting), semanticExtensions, requestAasIdentity: request.aasIdentity, operation: request.operation,
    profileAasIdentity: request.profileAasIdentity, analyzerAasIdentity: analyzer.aasIdentity, snapshotAasIdentity: request.snapshotAasIdentity };
  if (!sameJson(analysisKey, expectedAnalysis)) fail('analysis key semantic projection is not rebuilt from verified artifacts and request state');
  const effectiveBudgets = deriveEffectiveBudgets(budgetSources);
  assertKnownBudgets(effectiveBudgets, request, coordinates, rawInputBytes, fail);
  const capability = deepFreeze(structuredClone({ request, analysisKey, effectiveBudgets, selectedByTarget, policiesByTarget,
    rolloutByTarget, rawInputBytes, authorityNamespace: operatorAuthority.namespace, analyzer, operationProfile: requiredOperation,
    evaluatorProfiles: requiredEvaluators ?? [] }));
  preflightCapabilities.add(capability);
  return capability;
}

/** Post-result reconciliation accepts only an unforgeable completed preflight capability. */
export function reconcileInvocationResult(preflight, result) {
  const fail = (message) => { throw new TypeError(`invalid AAS invocation result: ${message}`); };
  if (arguments.length !== 2) fail('replacement raw byte arguments are forbidden');
  if (!preflightCapabilities.has(preflight)) fail('authentic completed preflight capability is required');
  assertResultInvariants(result, preflight.request, preflight.rawInputBytes);
  if (result.analysisKeyAasIdentity !== preflight.analysisKey.aasIdentity) fail('analysis key identity mismatch');
  for (const target of preflight.request.targets) {
    const resolution = result.resolutions.find(({ targetId }) => targetId === target.id);
    const selected = preflight.selectedByTarget[target.id];
    if (selected && resolution.diagnostic.mode !== selected.mode) fail(`selected binding mode mismatch: ${target.id}`);
    if (resolution.diagnostic.rolloutDisposition !== preflight.rolloutByTarget[target.id]) fail(`binding rollout disposition mismatch: ${target.id}`);
  }
  const effectiveBudgets = preflight.effectiveBudgets;
  for (const [counter, budget] of Object.entries(counterBudgets)) if (result.realizedCounters[counter] > effectiveBudgets[budget]) fail(`realized ${counter} exceeds componentwise-minimum effective ${budget}`);
  return { result, effectiveBudgets };
}

/** Compatibility wrapper; callers should run preflightInvocation before work and reconcileInvocationResult afterward. */
export function assertInvocationInvariants(invocation, rawInputBytes) {
  const preflight = preflightInvocation(invocation, rawInputBytes);
  return reconcileInvocationResult(preflight, invocation.result);
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
