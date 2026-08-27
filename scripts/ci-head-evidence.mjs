import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
if (git.status !== 0) throw new Error(git.stderr || 'git rev-parse failed');
const head = git.stdout.trim();
const expected = process.env.AAS_EXPECTED_HEAD;
if (!expected || head !== expected) throw new Error(`checked-out HEAD mismatch: expected ${expected}, got ${head}`);
const digest = async (relative) => createHash('sha256').update(await readFile(path.join(root, relative))).digest('hex');
const evidence = {
  schemaVersion: '0.1',
  event: process.env.GITHUB_EVENT_NAME ?? null,
  checkedOutHead: head,
  pullRequestBase: process.env.AAS_PR_BASE || null,
  pullRequestHead: process.env.AAS_PR_HEAD || null,
  digests: {
    workflow: await digest('.github/workflows/verify.yml'),
    packageConfiguration: await digest('package.json'),
    dependencyLock: await digest('pnpm-lock.yaml')
  }
};
await writeFile(path.join(root, 'exact-head-evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
