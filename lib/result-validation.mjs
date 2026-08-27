const terminalFields = ['included', 'policyExcluded', 'unreadable', 'unsupported', 'unstable', 'unknown', 'budgetExhausted'];

/** Cross-field result invariants that JSON Schema cannot express. */
export function assertResultInvariants(result) {
  const fail = (message) => { throw new TypeError(`invalid AAS result: ${message}`); };
  if (!result || result.kind !== 'result') fail('result root required');
  const stages = new Set();
  for (const coverage of result.coverage) {
    if (stages.has(coverage.stage)) fail(`duplicate coverage stage: ${coverage.stage}`);
    stages.add(coverage.stage);
    if (terminalFields.reduce((sum, field) => sum + coverage[field], 0) !== coverage.denominator) fail(`inconsistent terminal counts: ${coverage.stage}`);
  }
  const overlayApplicable = result.resolutions.some((item) => item.diagnostic?.overlayAasIdentity);
  if (overlayApplicable && !stages.has('overlay-reevaluation')) fail('applicable overlay reevaluation coverage is missing');
  for (const resolution of result.resolutions) {
    const header = resolution.diagnostic;
    if (header.resultAasIdentity !== result.aasIdentity) fail(`result identity mismatch: ${resolution.targetId}`);
    if (header.requestAasIdentity !== result.requestAasIdentity) fail(`request identity mismatch: ${resolution.targetId}`);
    if (header.analysisKeyAasIdentity !== result.analysisKeyAasIdentity) fail(`analysis key mismatch: ${resolution.targetId}`);
    if (terminalFields.reduce((sum, field) => sum + header.coverageSummary[field], 0) !== header.coverageSummary.denominator) fail(`inconsistent header terminal counts: ${resolution.targetId}`);
    const severityTotal = Object.values(header.severityCounts).reduce((sum, count) => sum + count, 0);
    const actualSeverityTotal = result.diagnostics.filter((item) => item.targetId === resolution.targetId).length;
    if (severityTotal !== actualSeverityTotal) fail(`inconsistent severity counts: ${resolution.targetId}`);
    const actualOmissions = result.omissions.filter((item) => item.targetId === resolution.targetId).reduce((sum, item) => sum + item.count, 0);
    if (header.omissionCount !== actualOmissions) fail(`inconsistent omission count: ${resolution.targetId}`);
  }
  if (result.realizedCounters.diagnostics !== result.diagnostics.length) fail('realized diagnostic count mismatch');
}
