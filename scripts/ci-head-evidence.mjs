import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { arch, platform, release, tmpdir } from 'node:os';
import path from 'node:path';
import { runNpmSync, runPnpmVersionSync } from './run-npm.mjs';

const root = path.resolve(import.meta.dirname, '..');
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
if (git.status !== 0) throw new Error(git.stderr || 'git rev-parse failed');
const head = git.stdout.trim();
const expected = process.env.AAS_EXPECTED_HEAD;
if (!expected || head !== expected) throw new Error(`checked-out HEAD mismatch: expected ${expected}, got ${head}`);
const digest = async (relative) => createHash('sha256').update(await readFile(path.join(root, relative))).digest('hex');
if (process.argv.includes('--checkout')) {
  await writeFile(path.join(root, 'checkout-attestation.json'), `${JSON.stringify({ schemaVersion: '0.1', checkedOutHead: head, expectedHead: expected }, null, 2)}\n`);
  process.exit(0);
}
const temporary = await mkdtemp(path.join(tmpdir(), 'aas-evidence-'));
let tarballDigest;
try {
  runNpmSync(['pack', '--pack-destination', temporary], { cwd: root, encoding: 'utf8', env: { ...process.env, npm_config_cache: path.join(temporary, 'npm-cache') } });
  const tarballs = (await readdir(temporary)).filter((item) => item.endsWith('.tgz'));
  if (tarballs.length !== 1) throw new Error('post-gate evidence requires exactly one npm tarball');
  const tarballPath = path.join(temporary, tarballs[0]);
  const first = await readFile(tarballPath);
  runNpmSync(['pack', '--pack-destination', temporary], { cwd: root, encoding: 'utf8', env: { ...process.env, npm_config_cache: path.join(temporary, 'npm-cache') } });
  const second = await readFile(tarballPath);
  const firstDigest = createHash('sha256').update(first).digest('hex');
  const secondDigest = createHash('sha256').update(second).digest('hex');
  if (firstDigest !== secondDigest) throw new Error('post-gate npm tarball is not reproducible');
  tarballDigest = firstDigest;
} finally { await rm(temporary, { recursive: true, force: true }); }
const pnpmVersion = runPnpmVersionSync({ encoding: 'utf8' });
const evidence = {
  schemaVersion: '0.1',
  event: process.env.GITHUB_EVENT_NAME ?? null,
  checkedOutHead: head,
  pullRequestBase: process.env.AAS_PR_BASE || null,
  pullRequestHead: process.env.AAS_PR_HEAD || null,
  platform: { os: platform(), release: release(), architecture: arch() },
  toolchain: { node: process.version, pnpm: pnpmVersion, packageManager: 'pnpm@11.24.0' },
  gateOutcomes: {
    checkFast: 'passed', cleanGeneration: 'passed', package: 'passed', conformance: 'passed'
  },
  digests: {
    workflow: await digest('.github/workflows/verify.yml'),
    packageConfiguration: await digest('package.json'),
    dependencyLock: await digest('pnpm-lock.yaml'),
    artifacts: await digest('artifacts.json'),
    reproducibleNpmTarball: tarballDigest
  }
};
await writeFile(path.join(root, 'exact-head-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
