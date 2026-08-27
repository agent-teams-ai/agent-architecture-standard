import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sha256 } from '../lib/digests.mjs';
import { root, readJson } from './files.mjs';
import { assertPortablePackageInventory } from './package-paths.mjs';
import { runNpmSync } from './run-npm.mjs';

const temporary = await mkdtemp(path.join(tmpdir(), 'aas-package-'));
const run = (args, cwd = root) => runNpmSync(args, { cwd, encoding: 'utf8', env: { ...process.env, npm_config_cache: path.join(temporary, 'npm-cache') } });
try {
  const inventory = JSON.parse(run(['pack', '--json', '--dry-run']))[0].files.map((entry) => entry.path).sort();
  const manifest = await readJson('artifacts.json');
  const expectedInventory = ['LICENSE', 'README.md', 'package.json', 'artifacts.json', ...manifest.artifacts.map((entry) => entry.path)].sort();
  if (JSON.stringify(inventory) !== JSON.stringify(expectedInventory)) throw new Error(`packed inventory drift\nexpected: ${expectedInventory.join('\n')}\nactual: ${inventory.join('\n')}`);
  assertPortablePackageInventory(inventory);
  for (let pass = 0; pass < 2; pass++) run(['pack', '--pack-destination', temporary]);
  const tarballs = (await readdir(temporary)).filter((item) => item.endsWith('.tgz'));
  if (tarballs.length !== 1) throw new Error(`expected one stable tarball path, got ${tarballs.length}`);
  const first = await readFile(path.join(temporary, tarballs[0]));
  run(['pack', '--pack-destination', temporary]);
  const second = await readFile(path.join(temporary, tarballs[0]));
  if (sha256(first) !== sha256(second)) throw new Error('repeated pack produced different tarball bytes');
  const installRoot = path.join(temporary, 'install');
  run(['init', '--yes'], temporary);
  run(['install', '--offline', '--ignore-scripts', '--no-package-lock', path.join(temporary, tarballs[0])], temporary);
  const installed = path.join(temporary, 'node_modules', 'agent-architecture-standard', 'artifacts.json');
  const installedManifest = JSON.parse(await readFile(installed, 'utf8'));
  if (JSON.stringify(installedManifest) !== JSON.stringify(manifest)) throw new Error('installed manifest differs');
  const installedRoot = path.dirname(installed);
  const listFiles = async (directory, prefix = '') => {
    const output = [];
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) output.push(...await listFiles(path.join(directory, entry.name), relative));
      else if (entry.isFile()) output.push(relative);
      else throw new Error(`unexpected installed package entry type: ${relative}`);
    }
    return output;
  };
  const installedInventory = (await listFiles(installedRoot)).sort();
  if (JSON.stringify(installedInventory) !== JSON.stringify(expectedInventory)) throw new Error(`installed inventory drift\nexpected: ${expectedInventory.join('\n')}\nactual: ${installedInventory.join('\n')}`);
  assertPortablePackageInventory(installedInventory, 'installed package inventory');
  for (const entry of manifest.artifacts) {
    const bytes = await readFile(path.join(installedRoot, entry.path));
    if (bytes.byteLength !== entry.byteLength) throw new Error(`installed byte length drift: ${entry.path}`);
    if (sha256(bytes) !== entry.contentDigest) throw new Error(`installed artifact digest drift: ${entry.path}`);
  }
  for (const relative of ['LICENSE', 'README.md', 'package.json', 'artifacts.json']) {
    if (sha256(await readFile(path.join(installedRoot, relative))) !== sha256(await readFile(path.join(root, relative)))) throw new Error(`installed package root artifact drift: ${relative}`);
  }
  const sourcePackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const installedPackage = JSON.parse(await readFile(path.join(installedRoot, 'package.json'), 'utf8'));
  if (JSON.stringify(installedPackage.exports) !== JSON.stringify(sourcePackage.exports)) throw new Error('installed exports drift');
  const expectedExports = {
    './artifacts': './artifacts.json',
    './version-matrix': './version-matrix.json',
    './schemas/*': './schemas/*.json',
    './registries/*': './registries/*.json',
    './generated/*': './generated/*'
  };
  if (JSON.stringify(installedPackage.exports) !== JSON.stringify(expectedExports)) throw new Error('package export surface is not the closed expected projection');
  for (const target of ['./artifacts.json', './version-matrix.json']) {
    if (!installedInventory.includes(target.slice(2))) throw new Error(`export target is absent: ${target}`);
  }
  for (const [prefix, suffix] of [['schemas/', '.json'], ['registries/', '.json'], ['generated/', '']]) {
    const exported = installedInventory.filter((item) => item.startsWith(prefix) && (!suffix || item.endsWith(suffix)));
    if (exported.length === 0) throw new Error(`wildcard export has no installed targets: ${prefix}`);
  }
} finally { await rm(temporary, { recursive: true, force: true }); }
