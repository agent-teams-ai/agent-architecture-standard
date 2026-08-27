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
const counterBudgets = Object.freeze({
  inputBytes: 'maxInputBytes', depth: 'maxDepth', pathSegments: 'maxPathSegments', pathBytes: 'maxPathBytes',
  entries: 'maxEntries', logicalBytes: 'maxLogicalBytes', readBytes: 'maxReadBytes', peakEntryBytes: 'maxPerEntryBytes',
  overlayOperations: 'maxOverlayOperations', targets: 'maxTargets', evidenceReferences: 'maxEvidenceReferences',
  extensionBytes: 'maxExtensionBytes', diagnostics: 'maxDiagnostics', outputBytes: 'maxOutputBytes',
  peakConcurrency: 'maxConcurrency', totalWork: 'maxTotalWork'
});

/** Cross-field result invariants that JSON Schema cannot express. */
export function assertResultInvariants(result, request) {
  const fail = (message) => { throw new TypeError(`invalid AAS result: ${message}`); };
  if (request !== undefined) assertRequestInvariants(request);
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
  if (result.resolutions.some((item) => item.resolution === 'decided')) {
    if (incompleteTotal(evaluation) !== 0) fail('decided results require complete evaluation coverage');
    const overlayCoverage = result.coverage.find((item) => item.stage === 'overlay-reevaluation');
    if (overlayApplicable && incompleteTotal(overlayCoverage) !== 0) fail('decided results require complete overlay reevaluation coverage');
  }
  const resolutionIds = result.resolutions.map((item) => item.targetId);
  if (new Set(resolutionIds).size !== resolutionIds.length) fail('duplicate result target resolution');
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
    if (resolution.resolution === 'decided') {
      if (resolution.verdict === undefined || header.verdict === undefined || resolution.verdict !== header.verdict) fail(`decided resolution requires one matching verdict: ${resolution.targetId}`);
    } else if (resolution.verdict !== undefined || header.verdict !== undefined) fail(`non-decided resolution forbids verdict: ${resolution.targetId}`);
    if (header.resultAasIdentity !== result.aasIdentity) fail(`result identity mismatch: ${resolution.targetId}`);
    if (header.requestAasIdentity !== result.requestAasIdentity) fail(`request identity mismatch: ${resolution.targetId}`);
    if (header.analysisKeyAasIdentity !== result.analysisKeyAasIdentity) fail(`analysis key mismatch: ${resolution.targetId}`);
    if (!sameJson(header.coverageSummary, Object.fromEntries(Object.entries(evaluation).filter(([key]) => key !== 'stage')))) fail(`header/result coverage mismatch: ${resolution.targetId}`);
    if (terminalTotal(header.coverageSummary) !== header.coverageSummary.denominator) fail(`inconsistent header terminal counts: ${resolution.targetId}`);
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
  if (result.omissions.some((item) => !resolutionIds.includes(item.targetId))) fail('omission refers to an unrequested target');
  if (result.diagnostics.some((item) => !resolutionIds.includes(item.targetId))) fail('diagnostic refers to an unrequested target');
  for (const diagnostic of result.diagnostics) for (const id of diagnostic.evidenceIds) if (!evidenceIdSet.has(id)) fail(`unknown evidence reference: ${id}`);
  if (result.realizedCounters.diagnostics !== result.diagnostics.length) fail('realized diagnostic count mismatch');
  if (result.realizedCounters.targets !== result.resolutions.length) fail('realized target count mismatch');
  const referenceCount = result.diagnostics.reduce((sum, item) => sum + item.evidenceIds.length, 0);
  if (result.realizedCounters.evidenceReferences !== referenceCount) fail('realized evidence-reference count mismatch');
  if (request !== undefined) assertRequestResultInvariants(request, result);
  return result;
}

/** Validate the request/result bijection and operation-specific accounting jointly. */
export function assertRequestResultInvariants(request, result) {
  const fail = (message) => { throw new TypeError(`invalid AAS request/result pair: ${message}`); };
  assertRequestInvariants(request);
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
      ['policy', header.policyAasIdentity, request.policyAasIdentity],
      ['binding', header.bindingAasIdentity, request.bindingAasIdentity],
      ['profile', header.profileAasIdentity, request.profileAasIdentity],
      ['analyzer', header.analyzerAasIdentity, request.analyzerAasIdentity],
      ['overlay', header.overlayAasIdentity, target.input.aasIdentity]
    ];
    for (const [name, actual, expected] of duplicated) if (actual !== expected) fail(`${name} identity mismatch: ${resolution.targetId}`);
    if (target.input.baseSnapshotAasIdentity !== request.snapshotAasIdentity) fail(`overlay baseSnapshot/request snapshot mismatch: ${resolution.targetId}`);
  }
  const evaluation = result.coverage.find((item) => item.stage === 'evaluation');
  if (result.resolutions.some((item) => item.resolution === 'decided') && incompleteTotal(evaluation) !== 0) fail('decided results require complete evaluation coverage');
  if (request.operation === 'validate-overlay@1') {
    for (const stage of ['evaluation', 'overlay-reevaluation']) if (!result.coverage.some((item) => item.stage === stage)) fail(`operation-required coverage stage is missing: ${stage}`);
    const operations = request.targets.reduce((sum, item) => sum + (item.input.operations?.length ?? 0), 0);
    if (result.realizedCounters.overlayOperations !== operations) fail('realized overlay-operation count mismatch');
    const overlayCoverage = result.coverage.find((item) => item.stage === 'overlay-reevaluation');
    if (result.resolutions.some((item) => item.resolution === 'decided') && incompleteTotal(overlayCoverage) !== 0) fail('decided results require complete overlay reevaluation coverage');
  }
  if (result.realizedCounters.targets !== request.targets.length) fail('realized request target count mismatch');
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

/** Validate request-only invariants before any evaluation begins. */
export function assertRequestInvariants(request) {
  const fail = (message) => { throw new TypeError(`invalid AAS request: ${message}`); };
  if (!request || request.kind !== 'request') fail('request root required');
  if (computeRequestAasIdentity(request) !== request.aasIdentity) fail('request aasIdentity does not match the normative projection');
  const ids = request.targets.map((item) => item.id);
  if (new Set(ids).size !== ids.length) fail('duplicate request target id');
  return request;
}
