import { sameCanonicalJson } from './canonical-json.mjs';
import { computeBindingAasIdentity, computeBindingSetAasIdentity, computeTargetSelectionAasIdentity } from './identity-validation.mjs';

export const compareAscii = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const pathContains = (parent, child) => child === parent || child.startsWith(`${parent}/`);
const bindingRank = (binding) => [binding.scope.subjectId === undefined ? 0 : 1,
  binding.scope.path === undefined ? 0 : binding.scope.path.split('/').length, binding.scope.ruleId === undefined ? 0 : 1];
const compareRank = (left, right) => {
  for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) return right[index] - left[index];
  return 0;
};
const bindingSemantics = (binding) => ({
  consumer: binding.consumer, repository: binding.repository, scope: binding.scope,
  pathProfile: binding.pathProfile, rolloutScope: binding.rolloutScope, mode: binding.mode, policyAasIdentity: binding.policyAasIdentity,
  profiles: binding.profiles, accountingProfile: binding.accountingProfile, budgets: binding.budgets,
  exceptions: binding.exceptions, promotionRecordAasIdentity: binding.promotionRecordAasIdentity
});
const bindingApplies = (binding, coordinate) => binding.consumer === coordinate.consumer
  && binding.repository === coordinate.repository && sameCanonicalJson(binding.pathProfile, coordinate.pathProfile)
  && pathContains(binding.scope.repositoryRoot, coordinate.path)
  && (binding.scope.subjectId === undefined || binding.scope.subjectId === coordinate.subjectId)
  && (binding.scope.path === undefined || pathContains(binding.scope.path, coordinate.path))
  && (binding.scope.ruleId === undefined || binding.scope.ruleId === coordinate.ruleId);

export const deriveBindingDecision = (bindings, coordinate, fail) => {
  const applicable = bindings.filter((binding) => bindingApplies(binding, coordinate));
  applicable.sort((left, right) => compareRank(bindingRank(left), bindingRank(right)) || compareAscii(left.aasIdentity, right.aasIdentity));
  if (applicable.length === 0) return { decision: { state: 'absent', reason: 'binding-missing', candidateBindings: [] }, applicable };
  for (let index = 0; index < applicable.length;) {
    const rank = bindingRank(applicable[index]);
    const equalRank = applicable.filter((binding) => compareRank(bindingRank(binding), rank) === 0);
    if (equalRank.some((binding) => !sameCanonicalJson(bindingSemantics(binding), bindingSemantics(equalRank[0])))) fail(`aas.problem.binding-set-conflict: ${coordinate.targetId}`);
    index += equalRank.length;
  }
  const topRank = bindingRank(applicable[0]);
  const tied = applicable.filter((binding) => compareRank(bindingRank(binding), topRank) === 0);
  const selected = tied[0];
  return { decision: { state: 'selected', selectedBindingId: selected.id, bindingAasIdentity: selected.aasIdentity,
    policyAasIdentity: selected.policyAasIdentity, candidateBindings: applicable.map(({ id, aasIdentity, policyAasIdentity }) => ({ id, aasIdentity, policyAasIdentity })) },
  applicable, selected, rolloutDisposition: selected.rolloutScope === 'all' || coordinate.rolloutCohorts.includes(selected.rolloutScope) ? 'included' : 'excluded' };
};

export function deriveBindingSelection(bindingSet, coordinate) {
  const fail = (message) => { throw new TypeError(`invalid AAS binding set: ${message}`); };
  if (!bindingSet || computeBindingSetAasIdentity(bindingSet) !== bindingSet.aasIdentity) fail('binding-set aasIdentity mismatch');
  if (!coordinate || computeTargetSelectionAasIdentity(coordinate) !== coordinate.aasIdentity) fail('target-selection aasIdentity mismatch');
  for (const binding of bindingSet.bindings ?? []) if (computeBindingAasIdentity(binding) !== binding.aasIdentity) fail(`binding aasIdentity mismatch: ${binding.id}`);
  return deriveBindingDecision(bindingSet.bindings, coordinate, fail);
}

export const assertBindingDecision = (decision, fail, label) => {
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

const bindingIndexKey = ({ consumer, repository, pathProfile }) => `${consumer}\u0000${repository}\u0000${pathProfile.aasIdentity}`;
const createNode = () => ({ bindings: [], children: new Map() });
export const buildBindingIndex = (bindings) => {
  const index = new Map();
  for (const binding of bindings) {
    const key = bindingIndexKey(binding), root = index.get(key) ?? createNode();
    let node = root;
    for (const segment of (binding.scope.path ?? binding.scope.repositoryRoot).split('/')) {
      const child = node.children.get(segment) ?? createNode(); node.children.set(segment, child); node = child;
    }
    node.bindings.push(binding); index.set(key, root);
  }
  return index;
};
export const queryBindingIndex = (index, coordinate) => {
  let node = index.get(bindingIndexKey(coordinate));
  if (!node) return [];
  const candidates = [...node.bindings];
  for (const segment of coordinate.path.split('/')) { node = node.children.get(segment); if (!node) break; candidates.push(...node.bindings); }
  return candidates;
};
