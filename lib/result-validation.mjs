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
  const payload = Buffer.from(canonicalize(requestIdentityProjection(request)), 'utf8');
  const magic = Buffer.from('AAS-ID');
  const domain = Buffer.from('aas.request.v0');
  const profile = Buffer.from('agent-architecture-canonical-json-rfc8785@0');
  const frame = Buffer.concat([u32be(magic.length), magic, u32be(domain.length), domain, u32be(profile.length), profile, u64be(payload.length), payload]);
  return `aas:v0:sha256:${createHash('sha256').update(frame).digest('hex')}`;
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
const exactSet = (values) => [...new Set(values)].sort();
const terminalTotal = (coverage) => terminalFields.reduce((sum, field) => sum + coverage[field], 0);
const incompleteTotal = (coverage) => terminalFields.filter((field) => field !== 'included').reduce((sum, field) => sum + coverage[field], 0);
const canonicalBytes = (value) => Buffer.byteLength(canonicalize(value), 'utf8');
const coverageWithoutStage = (coverage) => Object.fromEntries(Object.entries(coverage).filter(([key]) => key !== 'stage'));
const bindingCandidateProjection = (binding) => ({ id: binding.id, aasIdentity: binding.aasIdentity, policyAasIdentity: binding.policyAasIdentity });

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
    const severityTotal = Object.values(header.severityCounts).reduce((sum, count) => sum + count, 0);
    const actualSeverityTotal = result.diagnostics.filter((item) => item.targetId === resolution.targetId).length;
    if (severityTotal !== actualSeverityTotal) fail(`inconsistent severity counts: ${resolution.targetId}`);
    const actualCounts = Object.fromEntries(severities.map((severity) => [severity, result.diagnostics.filter((item) => item.targetId === resolution.targetId && item.severity === severity).length]));
    if (!sameJson(header.severityCounts, actualCounts)) fail(`incorrect severity buckets: ${resolution.targetId}`);
    const expectedHighest = [...severities].reverse().find((severity) => actualCounts[severity] > 0) ?? 'none';
    if (header.highestSeverity !== expectedHighest) fail(`incorrect highest severity: ${resolution.targetId}`);
    const actualOmissions = result.omissions.filter((item) => item.targetId === resolution.targetId).reduce((sum, item) => sum + item.count, 0);
    if (header.omissionCount !== actualOmissions) fail(`inconsistent omission count: ${resolution.targetId}`);
    const reasons = exactSet(result.omissions.filter((item) => item.targetId === resolution.targetId).map((item) => item.reason));
    if (!sameJson(exactSet(header.omissionReasons), reasons)) fail(`inconsistent omission reasons: ${resolution.targetId}`);
  }
  for (const aggregate of result.coverage) {
    const components = result.resolutions.map((resolution) => resolution.coverage.find((item) => item.stage === aggregate.stage)).filter(Boolean);
    if (components.length === 0) fail(`global coverage stage has no target components: ${aggregate.stage}`);
    const expected = Object.fromEntries(['denominator', ...terminalFields].map((field) => [field, components.reduce((sum, item) => sum + item[field], 0)]));
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
  const referenceCount = result.diagnostics.reduce((sum, item) => sum + item.evidenceIds.length, 0);
  if (result.realizedCounters.evidenceReferences !== referenceCount) fail('realized evidence-reference count mismatch');
  const expectedTotalWork = ['entries', 'logicalBytes', 'readBytes', 'overlayOperations', 'targets', 'evidenceReferences', 'extensionBytes', 'diagnostics']
    .reduce((sum, counter) => sum + result.realizedCounters[counter], 0);
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
    const operations = request.targets.reduce((sum, item) => sum + (item.input.operations?.length ?? 0), 0);
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

/** Validate all identity-bearing invocation documents and derive one fail-closed effective budget. */
export function assertInvocationInvariants({ request, result, analysisKey, bindings, applicableBindingsByTarget }, rawInputBytes) {
  const fail = (message) => { throw new TypeError(`invalid AAS invocation: ${message}`); };
  assertResultInvariants(result, request, rawInputBytes);
  if (!analysisKey || !Array.isArray(bindings) || !applicableBindingsByTarget || typeof applicableBindingsByTarget !== 'object') fail('analysis key, bindings, and per-target applicable bindings are required');
  if (analysisKey.aasIdentity !== result.analysisKeyAasIdentity) fail('analysis key identity mismatch');
  const profileIdentity = request.accountingProfileAasIdentity;
  if (analysisKey.accountingProfile?.aasIdentity !== profileIdentity) fail('accounting profile substitution between request and analysis key');
  const byIdentity = new Map(bindings.map((binding) => [binding.aasIdentity, binding]));
  if (byIdentity.size !== bindings.length) fail('duplicate binding identity document');
  const budgetSources = [request.budgets, analysisKey.budgets];
  for (const target of request.targets) {
    const applicable = applicableBindingsByTarget[target.id];
    if (!Array.isArray(applicable)) fail(`applicable binding set missing: ${target.id}`);
    for (const binding of applicable) {
      if (!sameJson(byIdentity.get(binding.aasIdentity), binding)) fail(`applicable binding is absent from supplied binding documents: ${target.id}/${binding.id}`);
      if (binding.accountingProfile?.aasIdentity !== profileIdentity) fail(`accounting profile substitution in binding: ${target.id}/${binding.id}`);
    }
    const expectedCandidates = applicable.map(bindingCandidateProjection);
    if (!sameJson(expectedCandidates, target.bindingSelection.candidateBindings)) fail(`request candidate bindings are not the exact ordered applicable-set bijection: ${target.id}`);
    if (target.bindingSelection.state === 'selected') {
      const selected = applicable.filter(({ id, aasIdentity }) => id === target.bindingSelection.selectedBindingId && aasIdentity === target.bindingSelection.bindingAasIdentity);
      if (selected.length !== 1 || selected[0].policyAasIdentity !== target.bindingSelection.policyAasIdentity) fail(`selected binding document identity mismatch: ${target.id}`);
      budgetSources.push(selected[0].budgets);
    }
    budgetSources.push(target.input.limits);
  }
  const budgetNames = exactSet(Object.values(counterBudgets));
  for (const [index, source] of budgetSources.entries()) {
    if (!source || !sameJson(exactSet(Object.keys(source)), budgetNames)) fail(`budget source ${index} must contain the exact closed budget field set`);
    for (const name of budgetNames) if (!Number.isSafeInteger(source[name]) || source[name] < 1) fail(`budget source ${index} has an invalid ${name}`);
  }
  const effectiveBudgets = Object.fromEntries(budgetNames.map((name) => [name, Math.min(...budgetSources.map((source) => source[name]))]));
  for (const [counter, budget] of Object.entries(counterBudgets)) if (result.realizedCounters[counter] > effectiveBudgets[budget]) fail(`realized ${counter} exceeds componentwise-minimum effective ${budget}`);
  return { result, effectiveBudgets };
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
