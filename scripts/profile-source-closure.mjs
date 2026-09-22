import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { sha256 } from '../lib/digests.mjs';
import { parseStrictJson } from '../lib/strict-json.mjs';

const SOURCES_BY_PROFILE = Object.freeze({
  'agent-architecture-resource-accounting-v0@1': Object.freeze([
    'schemas/common.schema.json', 'profiles/resource-accounting-v0-1-semantics.md', 'vectors/phase-1-remediation-v1.md'
  ]),
  'agent-architecture-portable-path-unicode17@1': Object.freeze([
    'schemas/common.schema.json', 'spec/security-and-conformance.md', 'vectors/phase-0-remediation-v1.md'
  ]),
  'agent-architecture-validate-overlay@1': Object.freeze([
    'schemas/overlay.schema.json', 'spec/policy-and-enforcement.md', 'vectors/phase-1-remediation-v1.md'
  ])
});

const assertRelative = (relative) => {
  if (typeof relative !== 'string' || relative.length === 0 || path.posix.isAbsolute(relative)
    || relative.includes('\\') || path.posix.normalize(relative) !== relative || relative.split('/').includes('..')) {
    throw new TypeError(`profile source closure path escapes its read boundary: ${relative}`);
  }
};

export function createProfileSourceBoundary(root, read = readFile) {
  const absoluteRoot = path.resolve(root);
  return Object.freeze({
    root: absoluteRoot,
    read: async (relative) => {
      assertRelative(relative);
      return read(path.join(absoluteRoot, relative));
    }
  });
}

const parseJson = async (boundary, relative) => parseStrictJson(await boundary.read(relative));

/** Verify the immutable profile-to-source closure through an explicit read boundary. */
export async function assertProfileSourceClosure(boundary, computeProfileAasIdentity) {
  if (!boundary || typeof boundary.root !== 'string' || typeof boundary.read !== 'function') {throw new TypeError('profile source closure requires an explicit root/read boundary');}
  if (typeof computeProfileAasIdentity !== 'function') {throw new TypeError('profile source closure requires the private profile identity function');}

  const manifest = await parseJson(boundary, 'artifacts.json');
  const artifacts = new Map(manifest.artifacts.map((entry) => [entry.path, entry]));
  if (artifacts.size !== manifest.artifacts.length) {throw new Error('profile source closure found duplicate manifest paths');}
  const assertArtifactBytes = async (relative, expected = artifacts.get(relative)) => {
    if (!expected) {throw new Error(`profile source closure artifact is absent from manifest: ${relative}`);}
    const bytes = await boundary.read(relative);
    if (bytes.byteLength !== expected.byteLength || sha256(bytes) !== expected.contentDigest) {throw new Error(`profile source closure exact-byte mismatch: ${relative}`);}
    return bytes;
  };

  await assertArtifactBytes('registries/profiles.json');
  const registry = await parseJson(boundary, 'registries/profiles.json');
  const profileEntries = manifest.artifacts.filter(({ class: artifactClass, path: relative }) => artifactClass === 'profile-definition' && relative.endsWith('.json'));
  const expectedPaths = Object.keys(SOURCES_BY_PROFILE).map((id) => registry.entries.find((entry) => entry.id === id)?.definitionArtifact);
  if (expectedPaths.some((value) => typeof value !== 'string')
    || JSON.stringify(profileEntries.map(({ path: relative }) => relative).toSorted()) !== JSON.stringify([...expectedPaths].toSorted())) {
    throw new Error('profile source closure definition inventory is not exactly registry anchored');
  }

  for (const { path: relative } of profileEntries) {
    const definitionBytes = await assertArtifactBytes(relative);
    const definition = parseStrictJson(definitionBytes);
    if (computeProfileAasIdentity(definition) !== definition.aasIdentity) {throw new Error(`profile source closure identity mismatch: ${relative}`);}
    const registrations = registry.entries.filter(({ definitionArtifact }) => definitionArtifact === relative);
    if (registrations.length !== 1 || registrations[0].id !== definition.id || registrations[0].profileAasIdentity !== definition.aasIdentity) {
      throw new Error(`profile source closure registry anchor mismatch: ${relative}`);
    }
    const sources = SOURCES_BY_PROFILE[definition.id];
    if (!sources) {throw new Error(`profile source closure has no immutable source map: ${relative}`);}
    const references = [definition.schemas?.[0], definition.semanticsArtifacts?.[0], definition.definitionVectorSuites?.[0]];
    if (references.some((reference) => !reference)) {throw new Error(`profile source closure has an incomplete definition: ${relative}`);}
    for (let index = 0; index < sources.length; index += 1) {
      const source = sources[index], reference = references[index];
      const bytes = await assertArtifactBytes(source);
      if (bytes.byteLength !== reference.byteLength || sha256(bytes) !== reference.contentDigest) {
        throw new Error(`profile source closure pin mismatch: ${relative} -> ${source}`);
      }
    }
  }
}
