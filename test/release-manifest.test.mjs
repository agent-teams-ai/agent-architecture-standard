import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseStrictJson } from '../lib/strict-json.mjs';
import { assertReleaseCohortsNonReuse, assertReleaseManifestInvariants, computeReleaseManifestAasIdentity } from '../lib/release-validation.mjs';

const load = async (name) => parseStrictJson(await readFile(new URL(`../vectors/schema/positive/${name}`, import.meta.url)));

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
    (value) => { value.supportedVersions = ['0.1.0']; },
    (value) => { value.members.push(structuredClone(value.members[0])); },
    (value) => { value.publicationOrder = []; }
  ];
  for (const mutate of mutations) {
    const value = structuredClone(original); mutate(value);
    assert.throws(() => assertReleaseManifestInvariants(value), /invalid AAS release manifest/);
  }
});
