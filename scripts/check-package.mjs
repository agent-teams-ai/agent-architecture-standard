import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sha256 } from '../lib/digests.mjs';
import { root, readJson } from './files.mjs';
import { assertPortablePackageInventory } from './package-paths.mjs';

const temporary = await mkdtemp(path.join(tmpdir(), 'aas-package-'));
const run = (args, cwd = root) => {
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env, npm_config_cache: path.join(temporary, 'npm-cache') } });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout;
};
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
} finally { await rm(temporary, { recursive: true, force: true }); }
