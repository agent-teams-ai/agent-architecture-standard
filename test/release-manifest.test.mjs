import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseStrictJson } from '../lib/strict-json.mjs';
import { assertReleaseCohortsNonReuse, assertReleaseManifestInvariants, computeReleaseManifestAasIdentity } from '../lib/release-validation.mjs';

const load = async (name) => parseStrictJson(await readFile(new URL(`../vectors/schema/positive/${name}`, import.meta.url)));
const resign = (manifest) => { manifest.aasIdentity = computeReleaseManifestAasIdentity(manifest); return manifest; };

test('release vectors close identity, cohort, DAG pins, and publication order', async () => {
  const manifests = await Promise.all(['release-manifest-rc.json', 'release-manifest-numeric.json'].map(load));
  for (const manifest of manifests) assert.doesNotThrow(() => assertReleaseManifestInvariants(manifest));
  assert.doesNotThrow(() => assertReleaseCohortsNonReuse(...manifests));
});

test('numeric cohort cannot relabel RC artifacts, claims, sidecars, or evidence', async () => {
  const rc = await load('release-manifest-rc.json');
  const numeric = await load('release-manifest-numeric.json');
  numeric.claims = structuredClone(rc.claims);
  numeric.aasIdentity = computeReleaseManifestAasIdentity(numeric);
  assert.throws(() => assertReleaseCohortsNonReuse(rc, numeric), /reused/);
});

test('release closure fails for mixed cohorts, duplicate members, bad pins, cycles, and order', async () => {
  const original = await load('release-manifest-rc.json');
  const mutations = [
    ['uniform version cohort', (value) => { value.supportedVersions = ['0.1.0']; }, /supportedVersions/],
    ['duplicate member', (value) => { value.members.push(structuredClone(value.members[0])); }, /duplicate member name/],
    ['publication closure', (value) => { value.publicationOrder = []; }, /publicationOrder/],
    ['dependency pin', (value) => { value.dependencies = [{ from: 'aas-core', to: 'aas-core', version: value.members[0].version, artifactAasIdentity: value.members[0].artifact.aasIdentity }]; }, /self dependency/]
  ];
  for (const [name, mutate, invariant] of mutations) {
    const value = structuredClone(original); mutate(value); resign(value);
    assert.throws(() => assertReleaseManifestInvariants(value), invariant, name);
  }
});

test('release DAG rejects bad pins and actual cycles after identities are recomputed', async () => {
  const original = await load('release-manifest-rc.json');
  const addMember = (value) => {
    const member = structuredClone(value.members[0]); member.name = 'aas-schema';
    for (const [index, artifact] of [member.artifact, member.provenance, member.sbom].entries()) artifact.aasIdentity = `aas:v0:sha256:${String(index + 3).repeat(64)}`;
    value.members.push(member); value.publicationOrder = ['aas-schema', 'aas-core'];
  };
  const badPin = structuredClone(original); addMember(badPin);
  badPin.dependencies = [{ from: 'aas-core', to: 'aas-schema', version: badPin.members[1].version, artifactAasIdentity: 'aas:v0:sha256:' + 'f'.repeat(64) }]; resign(badPin);
  assert.throws(() => assertReleaseManifestInvariants(badPin), /dependency pin\/identity mismatch/);
  const cycle = structuredClone(original); addMember(cycle);
  cycle.dependencies = [
    { from: 'aas-core', to: 'aas-schema', version: cycle.members[1].version, artifactAasIdentity: cycle.members[1].artifact.aasIdentity },
    { from: 'aas-schema', to: 'aas-core', version: cycle.members[0].version, artifactAasIdentity: cycle.members[0].artifact.aasIdentity }
  ]; resign(cycle);
  assert.throws(() => assertReleaseManifestInvariants(cycle), /dependency cycle/);
});

test('cohort comparison independently rejects identity, byte, traceability, and cohort-name bypasses', async () => {
  const rc = await load('release-manifest-rc.json');
  const numericOriginal = await load('release-manifest-numeric.json');
  const cases = [
    ['duplicate cohort', (value) => { value.cohort = rc.cohort; }, /duplicate cohort identity/],
    ['artifact identity only', (value) => { value.members[0].artifact.aasIdentity = rc.members[0].artifact.aasIdentity; }, /identity reused/],
    ['artifact digest only', (value) => { value.members[0].artifact.contentDigest = rc.members[0].artifact.contentDigest; }, /bytes reused/],
    ['traceability identity', (value) => { value.traceabilityMatrices[0] = rc.traceabilityMatrices[0]; }, /identity reused/]
  ];
  for (const [name, mutate, invariant] of cases) {
    const numeric = structuredClone(numericOriginal); mutate(numeric); resign(numeric);
    assert.throws(() => assertReleaseCohortsNonReuse(rc, numeric), invariant, name);
  }
});

test('release comparator rejects unrelated but individually valid cohorts', async () => {
  const rc = await load('release-manifest-rc.json');
  const numericOriginal = await load('release-manifest-numeric.json');
  const renamed = structuredClone(numericOriginal);
  renamed.members[0].name = 'unrelated-package'; renamed.publicationOrder = ['unrelated-package']; resign(renamed);
  assert.throws(() => assertReleaseCohortsNonReuse(rc, renamed), /identical member names/);
  const wrongBase = structuredClone(numericOriginal);
  wrongBase.members[0].version = '0.9.1'; wrongBase.supportedVersions = ['0.9.1']; resign(wrongBase);
  assert.throws(() => assertReleaseCohortsNonReuse(rc, wrongBase), /base version does not correspond/);
});
