import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { arch, platform, release, tmpdir } from 'node:os';
import path from 'node:path';
import { runNpmSync, runPnpmVersionSync } from './run-npm.mjs';
import { assertCleanGitStatus, assertPnpmVersion, parsePinnedPnpmVersion, resolveEvidencePath } from './evidence-helpers.mjs';

const root = path.resolve(import.meta.dirname, '..');
let evidencePath = resolveEvidencePath(process.env.AAS_EVIDENCE_PATH, root);
const gitRun = (args, cwd = root) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.error) {throw new Error(`git ${args.join(' ')} failed to start: ${result.error.message}`, { cause: result.error });}
  if (result.status !== 0) {throw new Error(result.stderr || `git ${args.join(' ')} failed`);}
  return result.stdout.trim();
};
const assertMaterialization = (cwd, expectedHead, includeUntracked) => {
  const actual = gitRun(['rev-parse', 'HEAD'], cwd);
  if (actual !== expectedHead) {throw new Error(`checked-out HEAD mismatch: expected ${expectedHead}, got ${actual}`);}
  const status = gitRun(['status', '--porcelain', includeUntracked ? '--untracked-files=all' : '--untracked-files=no'], cwd);
  assertCleanGitStatus(status, includeUntracked ? 'commit materialization' : 'root tracked workspace');
};
const writeEvidence = async (target, bytes) => {
  const temporaryPath = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporaryPath, bytes, { flag: 'wx' });
    await rename(temporaryPath, target);
  } finally {
    await rm(temporaryPath, { force: true });
  }
};

const head = gitRun(['rev-parse', 'HEAD']);
const expected = process.env.AAS_EXPECTED_HEAD;
if (!expected || head !== expected) {throw new Error(`checked-out HEAD mismatch: expected ${expected}, got ${head}`);}
assertMaterialization(root, head, false);
await mkdir(path.dirname(evidencePath), { recursive: true });
evidencePath = resolveEvidencePath(path.join(await realpath(path.dirname(evidencePath)), path.basename(evidencePath)), await realpath(root));
if (process.argv.includes('--checkout')) {
  await writeEvidence(evidencePath, `${JSON.stringify({ schemaVersion: '0.1', checkedOutHead: head, expectedHead: expected }, null, 2)}\n`);
  process.exit(0);
}

const packageDocument = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const pinnedPnpmVersion = parsePinnedPnpmVersion(packageDocument.packageManager);
const trustedPnpmHome = await realpath(process.env.PNPM_HOME ?? '').catch((error) => { throw new Error(`PNPM_HOME cannot be resolved as a trusted tool directory: ${error.message}`, { cause: error }); });
const actualPnpmVersion = runPnpmVersionSync({ encoding: 'utf8' }, { pnpmHome: trustedPnpmHome, workspaceRoot: await realpath(root) });
assertPnpmVersion(actualPnpmVersion, pinnedPnpmVersion);

const temporary = await mkdtemp(path.join(tmpdir(), 'aas-clean-evidence-'));
const worktree = path.join(temporary, 'commit');
let worktreeAdded = false;
let tarballDigest;
const committedDigest = async (relative) => createHash('sha256').update(await readFile(path.join(worktree, relative))).digest('hex');
try {
  gitRun(['worktree', 'add', '--detach', worktree, head]);
  worktreeAdded = true;
  assertMaterialization(worktree, head, true);
  const packed = [];
  for (const name of ['pack-one', 'pack-two']) {
    const destination = path.join(temporary, name);
    await mkdir(destination);
    runNpmSync(['pack', '--pack-destination', destination], { cwd: worktree, encoding: 'utf8', env: { ...process.env, npm_config_cache: path.join(temporary, 'npm-cache') } });
    const tarballs = (await readdir(destination)).filter((item) => item.endsWith('.tgz'));
    if (tarballs.length !== 1) {throw new Error('post-gate evidence requires exactly one npm tarball per clean pack');}
    packed.push(await readFile(path.join(destination, tarballs[0])));
  }
  const digests = packed.map((bytes) => createHash('sha256').update(bytes).digest('hex'));
  if (digests[0] !== digests[1]) {throw new Error('post-gate npm tarball is not reproducible');}
  tarballDigest = digests[0];
  assertMaterialization(worktree, head, true);

  const evidence = {
    schemaVersion: '0.1', event: process.env.GITHUB_EVENT_NAME ?? null,
    checkedOutHead: head, pullRequestBase: process.env.AAS_PR_BASE || null,
    pullRequestHead: process.env.AAS_PR_HEAD || null,
    platform: { os: platform(), release: release(), architecture: arch() },
    toolchain: { node: process.version, pnpm: actualPnpmVersion, packageManager: packageDocument.packageManager },
    gateOutcomes: { checkIndex: 'passed', checkSchemas: 'passed', checkCorpus: 'passed', typecheck: 'passed', cleanGeneration: 'passed', package: 'passed', conformance: 'passed' },
    digests: {
      workflow: await committedDigest('.github/workflows/verify.yml'),
      packageConfiguration: await committedDigest('package.json'),
      dependencyLock: await committedDigest('pnpm-lock.yaml'),
      artifacts: await committedDigest('artifacts.json'),
      reproducibleNpmTarball: tarballDigest
    }
  };
  assertMaterialization(worktree, head, true);
  assertMaterialization(root, head, false);
  await writeEvidence(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  assertMaterialization(root, head, false);
} finally {
  if (worktreeAdded) {gitRun(['worktree', 'remove', '--force', worktree]);}
  await rm(temporary, { recursive: true, force: true });
}
