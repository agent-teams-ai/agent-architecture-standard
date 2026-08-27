import { createHash } from 'node:crypto';

const canonicalize = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
};
const u32be = (value) => { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(value); return bytes; };
const u64be = (value) => { const bytes = Buffer.alloc(8); bytes.writeBigUInt64BE(BigInt(value)); return bytes; };

export function releaseManifestIdentityProjection(manifest) {
  const projection = structuredClone(manifest);
  delete projection.aasIdentity;
  return projection;
}

export function computeReleaseManifestAasIdentity(manifest) {
  const payload = Buffer.from(canonicalize(releaseManifestIdentityProjection(manifest)), 'utf8');
  const magic = Buffer.from('AAS-ID');
  const domain = Buffer.from('aas.release-manifest.v0');
  const profile = Buffer.from('agent-architecture-canonical-json-rfc8785@0');
  const frame = Buffer.concat([u32be(magic.length), magic, u32be(domain.length), domain, u32be(profile.length), profile, u64be(payload.length), payload]);
  return `aas:v0:sha256:${createHash('sha256').update(frame).digest('hex')}`;
}

export function assertReleaseManifestInvariants(manifest) {
  const fail = (message) => { throw new TypeError(`invalid AAS release manifest: ${message}`); };
  if (!manifest || typeof manifest !== 'object') fail('manifest object required');
  if (computeReleaseManifestAasIdentity(manifest) !== manifest.aasIdentity) fail('aasIdentity does not match the normative projection');
  const byName = new Map();
  const artifactIdentities = new Set();
  for (const member of manifest.members) {
    if (byName.has(member.name)) fail(`duplicate member name: ${member.name}`);
    if (artifactIdentities.has(member.artifact.aasIdentity)) fail(`duplicate member artifact identity: ${member.artifact.aasIdentity}`);
    byName.set(member.name, member);
    artifactIdentities.add(member.artifact.aasIdentity);
  }
  const versions = manifest.members.map((member) => member.version);
  const rc = versions.every((version) => /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)-rc\.[1-9][0-9]*$/u.test(version));
  const numeric = versions.every((version) => /^0\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u.test(version));
  if (!rc && !numeric) fail('members must form one uniform RC or numeric 0.x cohort');
  const exactVersions = [...new Set(versions)].sort();
  if (canonicalize([...manifest.supportedVersions].sort()) !== canonicalize(exactVersions)) fail('supportedVersions must exactly equal member versions');
  const edges = new Set();
  const graph = new Map([...byName.keys()].map((name) => [name, []]));
  for (const edge of manifest.dependencies) {
    if (!byName.has(edge.from) || !byName.has(edge.to)) fail(`dependency endpoint is not a member: ${edge.from} -> ${edge.to}`);
    if (edge.from === edge.to) fail(`self dependency: ${edge.from}`);
    const key = `${edge.from}\u0000${edge.to}`;
    if (edges.has(key)) fail(`duplicate dependency edge: ${edge.from} -> ${edge.to}`);
    edges.add(key);
    const dependency = byName.get(edge.to);
    if (edge.version !== dependency.version || edge.artifactAasIdentity !== dependency.artifact.aasIdentity) fail(`dependency pin/identity mismatch: ${edge.from} -> ${edge.to}`);
    graph.get(edge.from).push(edge.to);
  }
  const visiting = new Set(), visited = new Set();
  const visit = (name) => {
    if (visiting.has(name)) fail(`dependency cycle at ${name}`);
    if (visited.has(name)) return;
    visiting.add(name); for (const dependency of graph.get(name)) visit(dependency); visiting.delete(name); visited.add(name);
  };
  for (const name of graph.keys()) visit(name);
  if (manifest.publicationOrder.length !== byName.size || new Set(manifest.publicationOrder).size !== byName.size || manifest.publicationOrder.some((name) => !byName.has(name))) fail('publicationOrder must contain each member exactly once');
  const rank = new Map(manifest.publicationOrder.map((name, index) => [name, index]));
  for (const edge of manifest.dependencies) if (rank.get(edge.to) >= rank.get(edge.from)) fail(`publication order violates dependency: ${edge.from} -> ${edge.to}`);
  return manifest;
}

const cohortArtifactRefs = (manifest) => [
  ...manifest.members.flatMap((member) => [member.artifact, member.provenance, member.sbom]),
  ...manifest.traceabilityMatrices,
  ...Object.values(manifest.releaseEvidence)
];
const cohortIdentityRefs = (manifest) => [
  ...manifest.schemas, ...manifest.registries, ...manifest.vectors, ...manifest.profiles,
  ...manifest.claims, ...manifest.qualificationSidecars,
  ...Object.values(manifest.approvalSidecars), ...cohortArtifactRefs(manifest).map((artifact) => artifact.aasIdentity)
];

/** Enforce the separate-build rule between RC and numeric release cohorts. */
export function assertReleaseCohortsNonReuse(...manifests) {
  const fail = (message) => { throw new TypeError(`invalid AAS release cohorts: ${message}`); };
  const cohorts = new Set(), identityOwners = new Map(), digestOwners = new Map();
  for (const manifest of manifests) {
    assertReleaseManifestInvariants(manifest);
    if (cohorts.has(manifest.cohort)) fail(`duplicate cohort identity: ${manifest.cohort}`);
    cohorts.add(manifest.cohort);
    for (const identity of cohortIdentityRefs(manifest)) {
      const owner = identityOwners.get(identity);
      if (owner !== undefined && owner !== manifest.cohort) fail(`cohort-bound identity reused by ${owner} and ${manifest.cohort}: ${identity}`);
      identityOwners.set(identity, manifest.cohort);
    }
    for (const { contentDigest } of cohortArtifactRefs(manifest)) {
      const owner = digestOwners.get(contentDigest);
      if (owner !== undefined && owner !== manifest.cohort) fail(`cohort-bound bytes reused by ${owner} and ${manifest.cohort}: ${contentDigest}`);
      digestOwners.set(contentDigest, manifest.cohort);
    }
  }
  return manifests;
}
