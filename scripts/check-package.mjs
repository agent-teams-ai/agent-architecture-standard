import { access, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sha256 } from '../lib/digests.mjs';
import { root, readJson } from './files.mjs';
import { assertPortablePackageInventory } from './package-paths.mjs';
import { runNpmSync } from './run-npm.mjs';
import { computeProfileAasIdentity } from '../lib/identity-framing.mjs';
import { assertProfileSourceClosure, createProfileSourceBoundary } from './profile-source-closure.mjs';

const temporary = await mkdtemp(path.join(tmpdir(), 'aas-package-'));
const run = (args, cwd = root) => runNpmSync(args, { cwd, encoding: 'utf8', env: { ...process.env, npm_config_cache: path.join(temporary, 'npm-cache') } });
const listFiles = async (directory, prefix = '') => {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {output.push(...await listFiles(path.join(directory, entry.name), relative));}
    else if (entry.isFile()) {output.push(relative);}
    else {throw new Error(`unexpected installed package entry type: ${relative}`);}
  }
  return output;
};
try {
  await assertProfileSourceClosure(createProfileSourceBoundary(root), computeProfileAasIdentity);
  const inventory = JSON.parse(run(['pack', '--json', '--dry-run']))[0].files.map((entry) => entry.path).toSorted();
  const manifest = await readJson('artifacts.json');
  const rootPackageFiles = ['LICENSE', 'README.md', 'CONTRIBUTING.md', 'GOVERNANCE.md', 'MAINTAINERS.md', 'SECURITY.md', 'SOURCE.md', 'package.json', 'artifacts.json', 'docs/status/implementation-ledger.md'];
  const expectedInventory = [...rootPackageFiles, ...manifest.artifacts.map((entry) => entry.path)].toSorted();
  if (JSON.stringify(inventory) !== JSON.stringify(expectedInventory)) {throw new Error(`packed inventory drift\nexpected: ${expectedInventory.join('\n')}\nactual: ${inventory.join('\n')}`);}
  if (inventory.some((item) => /^(?:lib|test|scripts)\//u.test(item))) {throw new Error('Phase 1 helper/constructor code leaked into package files');}
  assertPortablePackageInventory(inventory);
  for (let pass = 0; pass < 2; pass++) {run(['pack', '--pack-destination', temporary]);}
  const tarballs = (await readdir(temporary)).filter((item) => item.endsWith('.tgz'));
  if (tarballs.length !== 1) {throw new Error(`expected one stable tarball path, got ${tarballs.length}`);}
  const first = await readFile(path.join(temporary, tarballs[0]));
  run(['pack', '--pack-destination', temporary]);
  const second = await readFile(path.join(temporary, tarballs[0]));
  if (sha256(first) !== sha256(second)) {throw new Error('repeated pack produced different tarball bytes');}
  run(['init', '--yes'], temporary);
  run(['install', '--offline', '--ignore-scripts', '--no-package-lock', path.join(temporary, tarballs[0])], temporary);
  const installed = path.join(temporary, 'node_modules', 'agent-architecture-standard', 'artifacts.json');
  const installedManifest = JSON.parse(await readFile(installed, 'utf8'));
  if (JSON.stringify(installedManifest) !== JSON.stringify(manifest)) {throw new Error('installed manifest differs');}
  const installedRoot = path.dirname(installed);
  await assertProfileSourceClosure(createProfileSourceBoundary(installedRoot), computeProfileAasIdentity);
  const installedInventory = (await listFiles(installedRoot)).toSorted();
  if (JSON.stringify(installedInventory) !== JSON.stringify(expectedInventory)) {throw new Error(`installed inventory drift\nexpected: ${expectedInventory.join('\n')}\nactual: ${installedInventory.join('\n')}`);}
  assertPortablePackageInventory(installedInventory, 'installed package inventory');
  for (const entry of manifest.artifacts) {
    const bytes = await readFile(path.join(installedRoot, entry.path));
    if (bytes.byteLength !== entry.byteLength) {throw new Error(`installed byte length drift: ${entry.path}`);}
    if (sha256(bytes) !== entry.contentDigest) {throw new Error(`installed artifact digest drift: ${entry.path}`);}
  }
  for (const relative of rootPackageFiles) {
    if (sha256(await readFile(path.join(installedRoot, relative))) !== sha256(await readFile(path.join(root, relative)))) {throw new Error(`installed package root artifact drift: ${relative}`);}
  }
  const sourcePackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const installedPackage = JSON.parse(await readFile(path.join(installedRoot, 'package.json'), 'utf8'));
  if (JSON.stringify(installedPackage.exports) !== JSON.stringify(sourcePackage.exports)) {throw new Error('installed exports drift');}
  const expectedExports = {
    './artifacts': './artifacts.json',
    './version-matrix': './version-matrix.json',
    './schemas/*': './schemas/*.json',
    './registries/*': './registries/*.json',
    './generated/*': { types: './generated/*.d.ts' }
  };
  if (JSON.stringify(installedPackage.exports) !== JSON.stringify(expectedExports)) {throw new Error('package export surface is not the closed expected projection');}
  if (Object.keys(installedPackage.exports).some((item) => /(?:kernel|result|release|identity)/u.test(item))) {throw new Error('PR2 production kernel leaked into Phase 1 exports');}
  for (const target of ['./artifacts.json', './version-matrix.json']) {
    if (!installedInventory.includes(target.slice(2))) {throw new Error(`export target is absent: ${target}`);}
  }
  const wildcardTargets = [];
  for (const [prefix, suffix] of [['schemas/', '.json'], ['registries/', '.json'], ['generated/', '']]) {
    const exported = installedInventory.filter((item) => item.startsWith(prefix) && (!suffix || item.endsWith(suffix)));
    if (exported.length === 0) {throw new Error(`wildcard export has no installed targets: ${prefix}`);}
    wildcardTargets.push(...exported);
  }
  const markdownLink = /\[[^\]]+\]\(([^)]+)\)/g;
  const markdownPaths = ['README.md', ...manifest.artifacts.filter((item) => item.mediaType === 'text/markdown').map((item) => item.path)];
  for (const relative of new Set(markdownPaths)) {
    const source = await readFile(path.join(installedRoot, relative), 'utf8');
    for (const match of source.matchAll(markdownLink)) {
      const rawTarget = match[1].split('#', 1)[0];
      if (!rawTarget || /^[a-z][a-z0-9+.-]*:/i.test(rawTarget)) {continue;}
      const target = path.resolve(path.dirname(path.join(installedRoot, relative)), decodeURIComponent(rawTarget));
      if (!target.startsWith(`${installedRoot}${path.sep}`)) {throw new Error(`installed markdown link escapes package: ${relative} -> ${rawTarget}`);}
      await access(target);
      await stat(target);
    }
  }
  for (const entry of manifest.artifacts.filter((item) => item.class === 'registry')) {
    const registry = JSON.parse(await readFile(path.join(installedRoot, entry.path), 'utf8'));
    for (const record of registry.entries) {
      const contact = record.contact.split('#', 1)[0];
      if (!contact || /^[a-z][a-z0-9+.-]*:/i.test(contact)) {throw new Error(`registry contact must be an installed package-relative reference: ${entry.path}/${record.id}`);}
      const target = path.resolve(installedRoot, decodeURIComponent(contact));
      if (!target.startsWith(`${installedRoot}${path.sep}`) || !installedInventory.includes(path.relative(installedRoot, target).split(path.sep).join('/'))) {throw new Error(`registry contact is absent from package: ${entry.path}/${record.id} -> ${record.contact}`);}
    }
  }

  const consumerRoot = path.join(temporary, 'consumer');
  await import('node:fs/promises').then(({ mkdir }) => mkdir(consumerRoot, { recursive: true }));
  const jsonTargets = wildcardTargets.filter((item) => item.endsWith('.json'));
  await writeFile(path.join(consumerRoot, 'consumer.mjs'), [
    "import artifacts from 'agent-architecture-standard/artifacts' with { type: 'json' };",
    "import matrix from 'agent-architecture-standard/version-matrix' with { type: 'json' };",
    ...jsonTargets.map((item, index) => `import json${index} from 'agent-architecture-standard/${item.slice(0, -5)}' with { type: 'json' };`),
    `const wildcardJson = [${jsonTargets.map((_, index) => `json${index}`).join(',')}];`,
    "if (!artifacts.artifacts.length || !matrix.cases.length || wildcardJson.some((value) => !value || typeof value !== 'object')) throw new Error('installed exports unusable');"
  ].join('\n') + '\n');
  const declarationTargets = wildcardTargets.filter((item) => item.endsWith('.d.ts'));
  const declarationImports = [];
  for (const [index, item] of declarationTargets.entries()) {
    const source = await readFile(path.join(installedRoot, item), 'utf8');
    const exported = [...source.matchAll(/^export type ([A-Za-z_$][A-Za-z0-9_$]*)/gm)].map((match) => match[1]);
    if (exported.length === 0) {throw new Error(`installed declaration has no consumable exports: ${item}`);}
    declarationImports.push(`import type { ${exported[0]} as T${index} } from 'agent-architecture-standard/${item.slice(0, -5)}';`, `declare const t${index}: T${index};`);
  }
  await writeFile(path.join(consumerRoot, 'consumer.ts'), [...declarationImports, `void [${declarationTargets.map((_, index) => `t${index}`).join(',')}];`].join('\n') + '\n');
  await writeFile(path.join(consumerRoot, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, module: 'nodenext', moduleResolution: 'nodenext', target: 'es2022' }, files: ['consumer.ts'] }, null, 2));
  const consumerEnvironment = { ...process.env, NODE_PATH: path.join(temporary, 'node_modules') };
  const runProcess = (command, args) => {
    const outcome = spawnSync(command, args, { cwd: consumerRoot, env: consumerEnvironment, encoding: 'utf8' });
    if (outcome.error || outcome.status !== 0) {throw new Error([
      `installed consumer failed: ${command} ${args.join(' ')}`,
      `error: ${outcome.error?.message ?? ''}`,
      `stderr: ${outcome.stderr ?? ''}`,
      `stdout: ${outcome.stdout ?? ''}`,
      `status: ${outcome.status ?? ''}`
    ].join('\n'));}
  };
  runProcess(process.execPath, ['consumer.mjs']);
  runProcess(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tsconfig.json']);
} finally { await rm(temporary, { recursive: true, force: true }); }
