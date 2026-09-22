import { canonicalJsonBytes, sameCanonicalJson } from './canonical-json.mjs';

export const terminalFields = ['included', 'policyExcluded', 'unreadable', 'unsupported', 'unstable', 'unknown', 'budgetExhausted'];
export const counterBudgets = Object.freeze({
  inputBytes: 'maxInputBytes', depth: 'maxDepth', pathSegments: 'maxPathSegments', pathBytes: 'maxPathBytes',
  entries: 'maxEntries', logicalBytes: 'maxLogicalBytes', readBytes: 'maxReadBytes', peakEntryBytes: 'maxPerEntryBytes',
  overlayOperations: 'maxOverlayOperations', targets: 'maxTargets', evidenceReferences: 'maxEvidenceReferences',
  extensionBytes: 'maxExtensionBytes', diagnostics: 'maxDiagnostics', outputBytes: 'maxOutputBytes',
  peakConcurrency: 'maxConcurrency', totalWork: 'maxTotalWork'
});
export const exactSet = (values) => [...new Set(values)].toSorted();
export const safeAdd = (sum, value) => {
  const next = sum + value;
  if (!Number.isSafeInteger(next)) {throw new TypeError('invalid AAS aggregate: safe-integer overflow');}
  return next;
};
export const terminalTotal = (coverage) => terminalFields.reduce((sum, field) => safeAdd(sum, coverage[field]), 0);
export const incompleteTotal = (coverage) => terminalFields.filter((field) => field !== 'included').reduce((sum, field) => safeAdd(sum, coverage[field]), 0);
const failBudgets = (message) => { throw new TypeError(`invalid AAS budgets: ${message}`); };

/** Length of a canonical request wire representation, useful only when those are the actual received bytes. */
export const canonicalRequestWireBytes = (request) => canonicalJsonBytes(request);
/** Canonical bytes of the complete normative extension maps, including their scope. */
export const canonicalRequestExtensionBytes = (request) => canonicalJsonBytes({
  request: { extensions: request.extensions, criticalExtensions: request.criticalExtensions },
  targets: request.targets.map(({ id, extensions, criticalExtensions }) => ({ id, extensions, criticalExtensions }))
});
/** Canonical result bytes charged to maxOutputBytes, including the final counter and self identities. */
export const canonicalResultOutputBytes = (result) => {
  const complete = structuredClone(result);
  let candidate = complete.realizedCounters?.outputBytes;
  if (!Number.isSafeInteger(candidate) || candidate < 0) {throw new TypeError('invalid AAS result: outputBytes seed must be a safe nonnegative integer');}
  for (let iteration = 0; iteration < 32; iteration += 1) {
    complete.realizedCounters.outputBytes = candidate;
    const next = canonicalJsonBytes(complete);
    if (!Number.isSafeInteger(next)) {throw new TypeError('invalid AAS result: outputBytes calculation overflow');}
    if (next === candidate) {return next;}
    candidate = next;
  }
  throw new TypeError('invalid AAS result: outputBytes calculation did not converge');
};

const validateBudgetSource = (source, label, fail) => {
  const budgetNames = exactSet(Object.values(counterBudgets));
  if (!source || !sameCanonicalJson(exactSet(Object.keys(source)), budgetNames)) {fail(`${label} must contain the exact closed budget field set`);}
  for (const name of budgetNames) {if (!Number.isSafeInteger(source[name]) || source[name] < 1) {fail(`${label} has an invalid ${name}`);}}
};
export { validateBudgetSource };
/** Bounded iterative reduction; safe for the maximum 100,000-target invocation. */
export function deriveEffectiveBudgets(budgetSources) {
  if (!Array.isArray(budgetSources) || budgetSources.length < 1 || budgetSources.length > 200002) {failBudgets('budget source count must be between 1 and 200002');}
  const budgetNames = exactSet(Object.values(counterBudgets));
  for (const [index, source] of budgetSources.entries()) {validateBudgetSource(source, `budget source ${index}`, failBudgets);}
  const effectiveBudgets = {};
  for (const name of budgetNames) {
    let minimum = Number.MAX_SAFE_INTEGER;
    for (const source of budgetSources) {if (source[name] < minimum) {minimum = source[name];}}
    effectiveBudgets[name] = minimum;
  }
  return effectiveBudgets;
}

export const pathBounds = (paths) => paths.reduce((known, value) => ({
  pathSegments: Math.max(known.pathSegments, value.split('/').length),
  pathBytes: Math.max(known.pathBytes, Buffer.byteLength(value, 'utf8'))
}), { pathSegments: 0, pathBytes: 0 });
export const rawRequestLowerBounds = (request, rawInputBytes) => {
  const overlayOperations = request.targets.reduce((sum, target) => safeAdd(sum, target.input.operations.length), 0);
  const extensionBytes = canonicalRequestExtensionBytes(request);
  return { inputBytes: rawInputBytes, targets: request.targets.length, overlayOperations, extensionBytes,
    ...pathBounds(request.targets.flatMap(({ input }) => input.operations.map(({ path }) => path))),
    totalWork: safeAdd(safeAdd(request.targets.length, overlayOperations), extensionBytes) };
};
export const assertLowerBounds = (effectiveBudgets, lowerBounds, fail) => {
  for (const [counter, value] of Object.entries(lowerBounds)) {
    if (value > effectiveBudgets[counterBudgets[counter]]) {fail(`known ${counter} lower bound exceeds effective ${counterBudgets[counter]}`);}
  }
};
export const knownPathLowerBounds = (request, coordinates) => {
  let pathSegments = 0, pathBytes = 0;
  for (const target of request.targets) {for (const value of [coordinates[target.id].path, ...(target.input.operations ?? []).map(({ path }) => path)]) {
    pathSegments = Math.max(pathSegments, value === '' ? 0 : value.split('/').length);
    pathBytes = Math.max(pathBytes, Buffer.byteLength(value, 'utf8'));
  }}
  return { pathSegments, pathBytes };
};
export const assertKnownBudgets = (effectiveBudgets, request, coordinates, rawInputBytes, fail) => {
  const overlayOperations = request.targets.reduce((sum, target) => safeAdd(sum, target.input.operations?.length ?? 0), 0);
  const extensionBytes = canonicalRequestExtensionBytes(request);
  const known = { inputBytes: rawInputBytes, targets: request.targets.length, overlayOperations, extensionBytes,
    ...knownPathLowerBounds(request, coordinates) };
  known.totalWork = safeAdd(safeAdd(known.targets, known.overlayOperations), known.extensionBytes);
  for (const [counter, value] of Object.entries(known)) {if (value > effectiveBudgets[counterBudgets[counter]]) {fail(`known ${counter} lower bound exceeds effective ${counterBudgets[counter]}`);}}
};
