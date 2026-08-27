import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { root, walk, readJson } from './files.mjs';
import { assertPortablePackageInventory } from './package-paths.mjs';
import { sha256 } from '../lib/digests.mjs';
import { assertRegistryInvariants, assertRegistryVectorInvariants, indexRegistryVectorCases } from '../lib/registry-validation.mjs';
import { computeProfileAasIdentity } from '../lib/identity-framing.mjs';
import { assertProfileSourceClosure, createProfileSourceBoundary } from './profile-source-closure.mjs';

const immutableDigests = new Map([
  ['decisions/README.md', 'sha256:8aa3b8d91ec3349bbee6489182741d0e7651f1a6490be869ba1c1f6b1a11c284'],
  ['decisions/phase-0-d0-d11-v1.md', 'sha256:ac3bfcc019a80483978f45ec4badc384e38124d601be606ae39566963ba422a6'],
  ['decisions/phase-0-d0-d11-v2.md', 'sha256:2815ce512740fe0f1abc81660243bb1a19ed940f54ee83ad53570dde3a2c2a7d'],
  ['docs/decisions/README.md', 'sha256:1ea7875ced40fd0e0d68b8dbe0e2c80d333846eb5d450980efc286d340294628'],
  ['docs/decisions/0001-authority-and-incubation.md', 'sha256:e3480af28ee9d033c229b84a18fd0c3c111f3b1a82cf14636b5db6ef14585826'],
  ['docs/decisions/0002-d1-relocation-status.md', 'sha256:7eb9d27a92527a3bba13a7278240376602b4eaea4cc5a5e6c1a9c6634f29d6dd'],
  ['vectors/phase-0-remediation-v1.md', 'sha256:90ac226d64160c05b11eebdd0e20062c5d29e505ab11036df68ca387225b427a']
]);
for (const [relative, expected] of immutableDigests) {
  const actual = sha256(await readFile(path.join(root, relative)));
  if (actual !== expected) throw new Error(`immutable historical artifact digest drift: ${relative}: ${actual}`);
}
const unicodeFold = await readFile(path.join(root, 'lib/unicode-case-fold-17.mjs'));
if (sha256(unicodeFold) !== 'sha256:84c81c250d57fac6fa9937b4379451bd6f421242cba9e5e4b80a3b0ad29c0f2e') throw new Error('vendored Unicode 17 case-fold derivation drift');
const unicodeNormalization = await readFile(path.join(root, 'lib/unicode-normalization-17.mjs'));
if (sha256(unicodeNormalization) !== 'sha256:48dec21f49f02b2672a0308dafe3a591b5c9fcb7f8a5377c08b4b75d75a34ab4') throw new Error('vendored Unicode 17 normalization derivation drift');
if (!unicodeFold.includes(Buffer.from('Source SHA-256: ff8d8fefbf123574205085d6714c36149eb946d717a0c585c27f0f4ef58c4183'))) throw new Error('vendored Unicode 17 case-fold provenance is missing');

const manifest = await readJson('artifacts.json');
const paths = manifest.artifacts.map((entry) => entry.path);
const registryCaseDocuments = new Map();
for (const entry of manifest.artifacts.filter((item) => item.class === 'vector' && item.path.endsWith('.json'))) {
  try { registryCaseDocuments.set(entry.path, await readJson(entry.path)); } catch { /* Invalid JSON vectors cannot index admission cases. */ }
}
const registryCaseIndex = indexRegistryVectorCases(registryCaseDocuments);
if (new Set(paths).size !== paths.length) throw new Error('artifacts.json contains duplicate paths');
if (paths.includes('artifacts.json') || paths.some((relative) => relative.endsWith('.tgz'))) throw new Error('manifest must not contain its own or a tarball digest');
assertPortablePackageInventory(paths, 'manifest');
for (const decision of [...immutableDigests.keys()].filter((item) => item.startsWith('decisions/') || item.startsWith('docs/decisions/'))) {
  if (paths.filter((relative) => relative === decision).length !== 1) throw new Error(`decision provenance closure is not indexed exactly once: ${decision}`);
}
for (const relative of paths) {
  const bytes = await readFile(path.join(root, relative));
  if (bytes.includes(Buffer.from('\r\n')) || bytes.includes(Buffer.from('\r'))) throw new Error(`non-LF line ending: ${relative}`);
}
const schemas = (await walk('schemas')).filter((item) => item.endsWith('.schema.json'));
const schemaEntries = manifest.artifacts.filter((entry) => entry.class === 'schema');
if (schemas.length !== schemaEntries.length || schemas.some((item) => schemaEntries.filter((entry) => entry.path === item).length !== 1)) throw new Error('every private provisional schema must be indexed exactly once');
const indexLinks = async (relative) => [...(await readFile(path.join(root, relative), 'utf8')).matchAll(/\]\(([^)#]+)(?:#[^)]+)?\)/gu)].map((match) => path.posix.normalize(path.posix.join(path.posix.dirname(relative), match[1])));
const schemaIndex = (await indexLinks('schemas/readme.md')).filter((item) => item.endsWith('.schema.json'));
if (JSON.stringify([...schemaIndex].sort()) !== JSON.stringify([...schemas].sort())) throw new Error('schema index rows do not exactly match physical schemas');
const registryFiles = (await walk('registries')).filter((item) => item.endsWith('.json'));
const registryEntries = manifest.artifacts.filter((entry) => entry.class === 'registry');
if (registryFiles.length !== registryEntries.length || registryFiles.some((item) => registryEntries.filter((entry) => entry.path === item).length !== 1)) throw new Error('every registry must be indexed exactly once');
const registryIndex = (await indexLinks('registries/readme.md')).filter((item) => item.endsWith('.json'));
if (JSON.stringify([...registryIndex].sort()) !== JSON.stringify([...registryFiles].sort())) throw new Error('registry index rows do not exactly match physical registries');
const profileArtifacts = await walk('profiles');
const profileEntries = manifest.artifacts.filter((entry) => entry.class === 'profile-definition').map((entry) => entry.path);
if (JSON.stringify(profileEntries.sort()) !== JSON.stringify(profileArtifacts.sort())) throw new Error('immutable profile-definition inventory is not indexed exactly');
await assertProfileSourceClosure(createProfileSourceBoundary(root), computeProfileAasIdentity);
const vectorFiles = (await walk('vectors')).filter((item) => item !== 'vectors/readme.md');
const vectorEntries = manifest.artifacts.filter((entry) => entry.class === 'vector').map((entry) => entry.path);
if (JSON.stringify([...vectorEntries].sort()) !== JSON.stringify([...vectorFiles].sort())) throw new Error('manifest vector inventory does not exactly match physical vectors');
const vectorIndex = await indexLinks('vectors/readme.md');
const expectedVectorRoots = ['vectors/phase-0-remediation-v1.md', 'vectors/phase-1-remediation-v1.md', 'vectors/binding-selection-permutations-v1.json', 'vectors/json/', 'vectors/schema/corpus.json', 'vectors/schema/catalog-corpus.json', 'vectors/registry/corpus.json'];
if (JSON.stringify(vectorIndex.sort()) !== JSON.stringify(expectedVectorRoots.sort())) throw new Error('vector index rows do not exactly match the normative suite roots');
for (const registryPath of registryFiles) {
  const registry = await readJson(registryPath);
  assertRegistryInvariants(registry, registryPath);
  assertRegistryVectorInvariants(registry, manifest, registryCaseIndex);
  const ids = new Set(registry.entries.map((entry) => entry.id));
  for (const entry of registry.entries) {
    if (entry.replacement !== undefined && !ids.has(entry.replacement)) throw new Error(`registry replacement is not owned by ${registry.registry}: ${entry.id} -> ${entry.replacement}`);
    for (const vector of entry.vectors) {
      if (!paths.includes(vector)) throw new Error(`registry vector is not manifest-owned: ${registry.registry}/${entry.id} -> ${vector}`);
    }
    if (registry.registry === 'envelope-versions' && (entry.kind !== 'envelope-version' || !Number.isSafeInteger(entry.orderingRank))) throw new Error(`invalid envelope-version registry entry: ${entry.id}`);
  }
}
const generated = (await walk('generated')).filter((item) => item.endsWith('.d.ts'));
const generatedEntries = manifest.artifacts.filter((entry) => entry.class === 'generated-declaration');
if (generated.length !== schemas.length || generated.length !== generatedEntries.length) throw new Error('schema/generated declaration cardinality drift');
for (const schema of schemas) {
  const expected = `generated/${path.basename(schema, '.schema.json')}.d.ts`;
  if (generatedEntries.filter((entry) => entry.path === expected).length !== 1) throw new Error(`missing exactly-once generated declaration: ${expected}`);
}

const markdownPaths = (await walk('.')).filter((item) => item.endsWith('.md') && !item.startsWith('node_modules/'));
const slug = (heading) => heading.toLowerCase().trim().replace(/[`*_~]/gu, '').replace(/[^\p{Letter}\p{Number} _-]/gu, '').replace(/\s+/gu, '-');
const headings = new Map();
for (const relative of markdownPaths) {
  const source = await readFile(path.join(root, relative), 'utf8');
  headings.set(relative, new Set([...source.matchAll(/^#{1,6}\s+(.+)$/gmu)].map((match) => slug(match[1]))));
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
    if (/^(?:https?:|mailto:)/u.test(match[1])) continue;
    const [targetPart, fragment] = match[1].split('#', 2);
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(relative), targetPart || path.posix.basename(relative)));
    const exists = await access(path.join(root, target)).then(() => true, () => false);
    if (!exists) throw new Error(`broken package Markdown link: ${relative} -> ${match[1]}`);
    if (fragment && target.endsWith('.md') && !headings.has(target)) { /* checked after all headings load below */ }
  }
}
const assertFragment = (owner, reference) => {
  const [targetPart, fragment] = reference.split('#', 2);
  if (!fragment || fragment.startsWith('/')) return;
  const candidates = [
    path.posix.normalize(path.posix.join(path.posix.dirname(owner), targetPart)),
    path.posix.normalize(targetPart),
    path.posix.normalize(path.posix.join('spec', targetPart))
  ];
  const target = candidates.find((item) => headings.has(item));
  if (!target || !headings.get(target).has(decodeURIComponent(fragment))) throw new Error(`unresolved requirement fragment: ${owner} -> ${reference}`);
};
const assertStructuredRequirement = (owner, reference) => {
  const [targetPart, fragment] = reference.split('#', 2);
  if (!targetPart || path.posix.isAbsolute(targetPart) || targetPart.includes('\\') || targetPart.split('/').includes('..')) throw new Error(`structured requirement is not package-root-relative: ${owner} -> ${reference}`);
  const target = path.posix.normalize(targetPart);
  if (target !== targetPart || !headings.has(target)) throw new Error(`structured requirement does not resolve under the sole package-root base: ${owner} -> ${reference}`);
  if (fragment && !fragment.startsWith('/') && !headings.get(target).has(decodeURIComponent(fragment))) throw new Error(`unresolved structured requirement fragment: ${owner} -> ${reference}`);
};
for (const relative of markdownPaths) {
  const source = await readFile(path.join(root, relative), 'utf8');
  for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) if (!/^(?:https?:|mailto:)/u.test(match[1])) assertFragment(relative, match[1]);
}
for (const relative of (await walk('vectors')).filter((item) => item.endsWith('.json'))) {
  let document; try { document = await readJson(relative); } catch { continue; }
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.requirement === 'string') assertStructuredRequirement(relative, value.requirement);
    for (const child of Object.values(value)) visit(child);
  };
  visit(document);
}
