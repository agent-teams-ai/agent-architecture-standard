import { assertIdentityDocumentPathInvariants } from './document-validation.mjs';
import { assertPortablePath } from './portable-path.mjs';
import { sameCanonicalJson } from './canonical-json.mjs';
import { buildBindingIndex, compareAscii, deriveBindingDecision, queryBindingIndex } from './binding-selection.mjs';
import { computeAnalysisKeyAasIdentity, computeAnalyzerAasIdentity, computeBindingAasIdentity,
  computeBindingSetAasIdentity, computeEffectivePolicyAasIdentity, computeExceptionAasIdentity,
  computeOverlayAasIdentity, computeProfileAasIdentity, computePromotionAasIdentity,
  computeTargetSelectionAasIdentity, RESOURCE_ACCOUNTING_PROFILE_AAS_IDENTITY } from './identity-validation.mjs';
import { assertRequestInvariants, assertResultInvariants } from './result-invariants.mjs';
import { assertKnownBudgets, assertLowerBounds, canonicalRequestExtensionBytes, counterBudgets,
  deriveEffectiveBudgets, exactSet, pathBounds, rawRequestLowerBounds, validateBudgetSource } from './resource-accounting.mjs';

const deepFreeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
};
const profileRef = ({ aasIdentity, id, definitionVersion }) => ({ version: definitionVersion, id, aasIdentity });
const exactKeys = (value, keys, label, fail) => {
  if (!value || typeof value !== 'object' || !sameCanonicalJson(Object.keys(value).sort(), [...keys].sort())) fail(`${label} must contain the exact trusted field set`);
};
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
  if ((expectedKind && artifact.kind !== expectedKind) || !sameCanonicalJson(reference, profileRef(artifact))) fail(`${label} ref does not match the complete verified ${expectedKind ? `${expectedKind} profile` : 'artifact'} ref: ${reference?.aasIdentity}`);
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
    if (!sameCanonicalJson(exception.pathProfile, policy.pathProfile)) fail(`embedded exception path profile differs from effective policy: ${label}/${exception.aasIdentity}`);
  }
};
const assertPolicyForBinding = (policy, binding, profiles, accounting, fail) => {
  assertEffectivePolicy(policy, profiles, fail, binding.id);
  const ruleIds = new Set(policy.rules.map(({ id }) => id));
  if (binding.scope.ruleId !== undefined && !ruleIds.has(binding.scope.ruleId)) fail(`binding scope rule is absent from effective policy: ${binding.id}/${binding.scope.ruleId}`);
  const bindingIds = binding.profiles.map(({ aasIdentity }) => aasIdentity);
  if (new Set(bindingIds).size !== bindingIds.length) fail(`binding has duplicate profile identities: ${binding.id}`);
  if (!sameCanonicalJson(sortedCompleteRefs(policy.profiles), sortedCompleteRefs(binding.profiles))) fail(`effective policy profile set does not agree with binding as complete refs: ${binding.id}`);
  for (const reference of binding.profiles) requireCompleteProfileRef(reference, profiles, undefined, `binding profile: ${binding.id}`, fail);
  if (!sameCanonicalJson(binding.accountingProfile, profileRef(accounting))) fail(`accounting profile ref does not match the complete verified accounting profile ref: ${binding.id}`);
  const policyExceptionIds = policy.exceptions.map(({ aasIdentity }) => aasIdentity);
  if (new Set(binding.exceptions).size !== binding.exceptions.length) fail(`binding has duplicate exception identities: ${binding.id}`);
  if (!sameCanonicalJson(exactSet(policyExceptionIds), exactSet(binding.exceptions))) fail(`effective policy exception identity set does not agree with binding: ${binding.id}`);
  if (policy.consumer !== binding.consumer || !sameCanonicalJson(policy.pathProfile, binding.pathProfile)
    || policy.scope !== (binding.scope.path ?? binding.scope.repositoryRoot)) fail(`effective policy consumer, scope, or path profile does not agree with binding: ${binding.id}`);
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
      dependencyIds.add(reference.aasIdentity); visit(requireCompleteProfileRef(reference, profiles, undefined, `profile dependency: ${profile.id}`, fail));
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
    || promotion.policy !== binding.policyAasIdentity || !sameCanonicalJson(sortedCompleteRefs(promotion.profiles), sortedCompleteRefs(binding.profiles))
    || promotion.rolloutScope !== binding.rolloutScope || promotion.previousMode !== expectedPrevious || promotion.nextMode !== binding.mode) {
    fail(`promotion record does not exactly authorize binding transition: ${binding.id}`);
  }
};

/** Create the one trusted, synchronous invocation authority boundary. */
export function createInvocationKernel({ operatorAuthority, targetAuthority, providerBudgets, ingressLimits } = {}, schemaAdmission) {
  const fail = (message) => { throw new TypeError(`invalid AAS invocation kernel: ${message}`); };
  exactKeys(schemaAdmission, ['assertSchema', 'parseSchemaBytes'], 'schemaAdmission', fail);
  // Capture the synchronous admission port exactly once; later mutation cannot change authority.
  const { assertSchema, parseSchemaBytes } = schemaAdmission;
  if (typeof assertSchema !== 'function' || typeof parseSchemaBytes !== 'function') fail('schemaAdmission functions are required');
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
  const parseCollection = (values, definition, label) => {
    if (!Array.isArray(values)) fail(`${label} must be a raw-byte collection`);
    return values.map((bytes, index) => parseSchemaBytes(bytes, definition, `${label}[${index}]`, limits).parsed);
  };
  const policyDocuments = parseCollection(operatorAuthority.effectivePolicies, 'effectivePolicy', 'effective policies');
  const profileDocuments = parseCollection(operatorAuthority.profiles, 'profile', 'profiles');
  const analyzerDocuments = parseCollection(operatorAuthority.analyzers, 'analyzer', 'analyzers');
  const promotionDocuments = parseCollection(operatorAuthority.promotionRecords, 'promotionRecord', 'promotion records');
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
  const bindingIndex = buildBindingIndex(admitted.bindings), capabilities = new WeakMap();

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
    if (!sameCanonicalJson(Object.keys(returned).sort(), requestKeys)) fail('resolver target-selection keys must exactly equal request target keys');
    const budgetSources = [...provisionalSources], selectedByTarget = {}, policiesByTarget = {}, rolloutByTarget = {}, coordinates = {};
    let requiredOperation = profileRef(requestOperation), requiredEvaluators;
    const examinedPaths = [...overlayPaths];
    for (const target of request.targets) {
      const coordinate = returned[target.id]; assertSchema(coordinate, 'targetSelection', `target selection ${target.id}`); assertPortablePath(coordinate.path);
      if (coordinate.targetId !== target.id || computeTargetSelectionAasIdentity(coordinate) !== coordinate.aasIdentity) fail(`target-selection identity mismatch: ${target.id}`);
      if (coordinate.aasIdentity !== target.targetSelectionAasIdentity) fail(`target-selection identity does not equal request-bound identity: ${target.id}`);
      if (!sameCanonicalJson(coordinate.pathProfile, target.input.pathProfile)) fail(`target-selection and overlay path-profile mismatch: ${target.id}`);
      requireCompleteProfileRef(coordinate.pathProfile, profiles, 'path', 'target-selection path profile', fail);
      coordinates[target.id] = coordinate; examinedPaths.push(coordinate.path);
      const derived = deriveBindingDecision(queryBindingIndex(bindingIndex, coordinate), coordinate, fail);
      for (const binding of derived.applicable) examinedPaths.push(binding.scope.repositoryRoot, ...(binding.scope.path ? [binding.scope.path] : []));
      if (!sameCanonicalJson(derived.decision, target.bindingSelection)) fail(`request binding selection is not the complete authoritative-catalog derivation: ${target.id}`);
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
        if (!sameCanonicalJson(operation, requiredOperation) || (requiredEvaluators && !sameCanonicalJson(evaluators, requiredEvaluators))) fail('heterogeneous selected profile sets');
        requiredEvaluators = evaluators; budgetSources.push(derived.selected.budgets);
        selectedByTarget[target.id] = derived.selected; policiesByTarget[target.id] = policy;
      }
    }
    const analyzerProfiles = new Map(analyzer.profiles.map((reference) => [reference.aasIdentity, reference]));
    for (const evaluator of requiredEvaluators ?? []) if (!sameCanonicalJson(analyzerProfiles.get(evaluator.aasIdentity), evaluator)) fail(`analyzer does not support evaluator: ${evaluator.aasIdentity}`);
    const semanticExtensions = { request: request.extensions, criticalRequest: request.criticalExtensions,
      targets: request.targets.map(({ id, extensions, criticalExtensions }) => ({ id, extensions, criticalExtensions })) };
    const effectiveBudgets = deriveEffectiveBudgets(budgetSources), lowerBounds = { ...pathBounds(examinedPaths) };
    const analysisKey = { aasIdentity: '', operationProfile: requiredOperation, evaluatorProfiles: requiredEvaluators ?? [],
      inputAasIdentities: [request.snapshotAasIdentity, ...request.targets.map(({ input }) => input.aasIdentity)], budgets: effectiveBudgets,
      accountingProfile: profileRef(accounting), semanticExtensions, requestAasIdentity: request.aasIdentity, operation: request.operation,
      profileAasIdentity: request.profileAasIdentity, analyzerAasIdentity: analyzer.aasIdentity, snapshotAasIdentity: request.snapshotAasIdentity };
    analysisKey.aasIdentity = computeAnalysisKeyAasIdentity(analysisKey); assertSchema(analysisKey, 'analysisKey', 'derived analysis key');
    assertKnownBudgets(effectiveBudgets, request, coordinates, wire.byteLength, fail); assertLowerBounds(effectiveBudgets, lowerBounds, fail);
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
