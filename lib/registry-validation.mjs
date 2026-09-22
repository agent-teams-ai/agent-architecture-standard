const expectedKinds = new Map([
  ['actions', 'action'], ['operations', 'operation'], ['problems', 'problem'],
  ['resolutions', 'resolution'], ['diagnostics', 'diagnostic'],
  ['profiles', 'profile'], ['extensions', 'extension'], ['envelope-versions', 'envelope-version']
]);
const failRegistry = (message) => { throw new TypeError(`invalid AAS registry: ${message}`); };
const failRegistryEvolution = (message) => { throw new TypeError(`invalid AAS registry evolution: ${message}`); };
const failRegistryVectors = (message) => { throw new TypeError(`invalid AAS registry vectors: ${message}`); };

export function assertRegistryInvariants(registry, relativePath) {
  const fail = failRegistry;
  const basename = relativePath?.replace(/^.*\//u, '').replace(/\.json$/u, '');
  if (basename && basename !== registry.registry) {fail(`file/registry identity mismatch: ${basename} != ${registry.registry}`);}
  const expectedKind = expectedKinds.get(registry.registry);
  const byId = new Map();
  for (const entry of registry.entries) {
    if (byId.has(entry.id)) {fail(`duplicate entry id: ${entry.id}`);}
    byId.set(entry.id, entry);
    if (expectedKind && entry.kind !== expectedKind) {fail(`entry kind mismatch: ${entry.id}`);}
    if (registry.registry === 'profiles' && typeof entry.role !== 'string') {fail(`profile role is required: ${entry.id}`);}
    if (registry.registry !== 'profiles' && entry.role !== undefined) {fail(`profile role on non-profile entry: ${entry.id}`);}
    if (registry.registry !== 'profiles' && (entry.profileAasIdentity !== undefined || entry.definitionArtifact !== undefined)) {fail(`profile definition anchor on non-profile entry: ${entry.id}`);}
    if ((entry.profileAasIdentity === undefined) !== (entry.definitionArtifact === undefined)) {fail(`profile definition identity and artifact must be established together: ${entry.id}`);}
    if (entry.status !== 'provisional' && entry.vectors.length === 0) {fail(`admitted entry lacks vectors: ${entry.id}`);}
  }
  for (const entry of registry.entries) {
    if (entry.replacement === undefined) {continue;}
    if (entry.replacement === entry.id) {fail(`self replacement: ${entry.id}`);}
    if (!['deprecated', 'withdrawn'].includes(entry.status)) {fail(`replacement on non-replaceable status: ${entry.id}`);}
    const target = byId.get(entry.replacement);
    if (!target) {fail(`replacement is not registry-owned: ${entry.id} -> ${entry.replacement}`);}
    if (target.kind !== entry.kind) {fail(`replacement kind mismatch: ${entry.id} -> ${entry.replacement}`);}
    if (target.status === 'withdrawn') {fail(`replacement target is withdrawn: ${entry.replacement}`);}
  }
  const visiting = new Set(), visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) {fail(`replacement cycle at ${id}`);}
    if (visited.has(id)) {return;}
    visiting.add(id); const next = byId.get(id).replacement; if (next !== undefined) {visit(next);} visiting.delete(id); visited.add(id);
  };
  for (const id of byId.keys()) {visit(id);}
  return registry;
}

/** Compare adjacent retained editions without permitting historical reassignment. */
export function assertRegistryEvolution(previous, current) {
  const fail = failRegistryEvolution;
  assertRegistryInvariants(previous);
  assertRegistryInvariants(current);
  if (previous.registry !== current.registry) {fail('registry name changed');}
  if (current.previousEdition !== previous.edition) {fail(`previousEdition must link exact prior edition ${previous.edition}`);}
  if (Number(current.edition) <= Number(previous.edition)) {fail('edition must increase');}
  const currentById = new Map(current.entries.map((entry) => [entry.id, entry]));
  const previousIds = new Set(previous.entries.map((entry) => entry.id));
  for (const entry of current.entries) {
    if (!previousIds.has(entry.id) && entry.introducedEdition !== current.edition) {fail(`new id introducedEdition must equal current edition ${current.edition}: ${entry.id}`);}
  }
  const transitions = new Map([
    ['reserved', new Set(['reserved', 'provisional'])],
    ['provisional', new Set(['provisional', 'active', 'deprecated', 'withdrawn'])],
    ['active', new Set(['active', 'deprecated', 'withdrawn'])],
    ['deprecated', new Set(['deprecated', 'withdrawn'])],
    ['withdrawn', new Set(['withdrawn'])]
  ]);
  for (const oldEntry of previous.entries) {
    const next = currentById.get(oldEntry.id);
    if (!next) {fail(`existing id removed: ${oldEntry.id}`);}
    for (const field of ['kind', 'role', 'semanticAuthority', 'introducedEdition', 'orderingRank']) {
      if (oldEntry[field] !== next[field]) {fail(`immutable ${field} changed: ${oldEntry.id}`);}
    }
    if (oldEntry.semanticsAasIdentity !== undefined && oldEntry.semanticsAasIdentity !== next.semanticsAasIdentity) {fail(`immutable semanticsAasIdentity changed: ${oldEntry.id}`);}
    if (oldEntry.semanticsAasIdentity === undefined && next.semanticsAasIdentity !== undefined
      && !(new Set(['reserved', 'provisional']).has(oldEntry.status) && next.status === 'provisional')) {fail(`semanticsAasIdentity established outside the provisional admission lifecycle: ${oldEntry.id}`);}
    if (!transitions.get(oldEntry.status)?.has(next.status)) {fail(`forbidden lifecycle transition ${oldEntry.status} -> ${next.status}: ${oldEntry.id}`);}
  }
  return current;
}

/** Index explicit registry admission cases by vector path and owned registry ID. */
export function indexRegistryVectorCases(documents) {
  const index = new Map();
  for (const [relative, document] of documents) {
    if (!Array.isArray(document?.cases)) {continue;}
    for (const item of document.cases) {
      if (typeof item?.registry !== 'string' || typeof item?.registryId !== 'string' || !['positive', 'negative'].includes(item?.polarity)) {continue;}
      const key = `${relative}\0${item.registry}\0${item.registryId}`;
      if (!index.has(key)) {index.set(key, new Set());}
      index.get(key).add(item.polarity);
    }
  }
  return index;
}

/** Validate registry vector ownership/class and activation polarity. */
export function assertRegistryVectorInvariants(registry, manifest, caseIndex = new Map()) {
  const fail = failRegistryVectors;
  const artifacts = new Map(manifest.artifacts.map((entry) => [entry.path, entry]));
  for (const entry of registry.entries) {
    const polarities = new Set();
    for (const vector of entry.vectors) {
      const artifact = artifacts.get(vector);
      if (!artifact || !['vector', 'version-matrix'].includes(artifact.class)) {fail(`vector is not a manifest-owned validation artifact: ${entry.id} -> ${vector}`);}
      for (const polarity of caseIndex.get(`${vector}\0${registry.registry}\0${entry.id}`) ?? []) {polarities.add(polarity);}
    }
    if (entry.status !== 'provisional' && (!polarities.has('positive') || !polarities.has('negative'))) {fail(`admitted entry lacks positive and negative vector polarity: ${entry.id}`);}
  }
  return registry;
}
