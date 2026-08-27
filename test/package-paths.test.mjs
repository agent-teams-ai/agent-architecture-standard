import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPortablePackageInventory } from '../scripts/package-paths.mjs';
import { assertPortablePath, assertPortablePathCollection, portablePathCollisionKey } from '../lib/portable-path.mjs';
import { runNpmSync, runPnpmVersionSync } from '../scripts/run-npm.mjs';
import { assertIdentityDocumentPathInvariants } from '../lib/document-validation.mjs';
import { assertCleanGitStatus, assertPnpmVersion, parsePinnedPnpmVersion, resolveEvidencePath } from '../scripts/evidence-helpers.mjs';
import { createHash } from 'node:crypto';
import { chmod, cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('npm runs its JavaScript CLI directly on Windows without a command shell', () => {
  let invocation;
  const stdout = '{"ok":true}';
  const result = runNpmSync(['pack', '--json', '--dry-run'], { encoding: 'utf8' }, {
    platform: 'win32',
    execPath: String.raw`C:\hostedtoolcache\windows\node\24.20.0\x64\node.exe`,
    spawnSync(command, args, options) {
      invocation = { command, args, options };
      return { status: 0, signal: null, stdout, stderr: '' };
    }
  });
  assert.equal(result, stdout);
  assert.deepEqual(invocation, {
    command: String.raw`C:\hostedtoolcache\windows\node\24.20.0\x64\node.exe`,
    args: [
      String.raw`C:\hostedtoolcache\windows\node\24.20.0\x64\node_modules\npm\bin\npm-cli.js`,
      'pack',
      '--json',
      '--dry-run'
    ],
    options: { encoding: 'utf8' }
  });
});

test('npm spawn errors retain their cause and command context', () => {
  const cause = Object.assign(new Error('spawn npm ENOENT'), { code: 'ENOENT' });
  assert.throws(
    () => runNpmSync(['pack', '--json', '--dry-run'], {}, {
      platform: 'linux',
      execPath: '/usr/bin/node',
      spawnSync() {
        return { status: null, signal: null, stdout: '', stderr: '', error: cause };
      }
    }),
    (error) => {
      assert.match(error.message, /npm pack --json --dry-run failed to start: spawn npm ENOENT/);
      assert.equal(error.cause, cause);
      return true;
    }
  );
});

test('npm runs its JavaScript CLI directly on POSIX without PATH lookup', () => {
  let invocation;
  runNpmSync(['pack'], {}, {
    platform: 'linux', execPath: '/opt/node/bin/node',
    spawnSync(command, args) { invocation = { command, args }; return { status: 0, stdout: '', stderr: '' }; }
  });
  assert.deepEqual(invocation, { command: '/opt/node/bin/node', args: ['/opt/node/lib/node_modules/npm/bin/npm-cli.js', 'pack'] });
});

test('pnpm version runs its Windows command shim through cmd.exe', () => {
  let invocation;
  const version = runPnpmVersionSync({ encoding: 'utf8' }, {
    platform: 'win32',
    comSpec: String.raw`C:\Windows\System32\cmd.exe`,
    pnpmHome: String.raw`C:\hostedtoolcache\pnpm`,
    workspaceRoot: String.raw`D:\a\repo\repo`,
    spawnSync(command, args, options) {
      invocation = { command, args, options };
      return { status: 0, signal: null, stdout: '11.24.0\r\n', stderr: '' };
    }
  });
  assert.equal(version, '11.24.0');
  assert.deepEqual(invocation, {
    command: String.raw`C:\Windows\System32\cmd.exe`,
    args: ['/d', '/s', '/c', String.raw`"C:\hostedtoolcache\pnpm\pnpm.cmd" --version`],
    options: { encoding: 'utf8' }
  });
});

test('pnpm version runs directly on POSIX and requires version output', () => {
  let invocation;
  assert.throws(() => runPnpmVersionSync({}, {
    platform: 'linux',
    pnpmHome: '/opt/pnpm', workspaceRoot: '/workspace/repo',
    spawnSync(command, args) {
      invocation = { command, args };
      return { status: 0, signal: null, stdout: '', stderr: '' };
    }
  }), /produced no version/);
  assert.deepEqual(invocation, { command: '/opt/pnpm/pnpm', args: ['--version'] });
});

test('pnpm version rejects launcher errors and nonzero exits', () => {
  const runtime = { platform: 'linux', pnpmHome: '/opt/pnpm', workspaceRoot: '/workspace/repo' };
  assert.throws(() => runPnpmVersionSync({}, { ...runtime, spawnSync: () => ({ status: 7, signal: null, stdout: '', stderr: 'bad pin' }) }), /exited with status 7/);
  const cause = Object.assign(new Error('spawn EACCES'), { code: 'EACCES' });
  assert.throws(() => runPnpmVersionSync({}, { ...runtime, spawnSync: () => ({ status: null, signal: null, stdout: '', stderr: '', error: cause }) }), (error) => error.cause === cause && /failed to start/.test(error.message));
});

test('pnpm launcher cannot resolve from a malicious workspace or relative tool home', () => {
  assert.throws(() => runPnpmVersionSync({}, { platform: 'linux', pnpmHome: '.', workspaceRoot: '/workspace/repo' }), /absolute trusted/);
  assert.throws(() => runPnpmVersionSync({}, { platform: 'linux', pnpmHome: '/workspace/repo/tools', workspaceRoot: '/workspace/repo' }), /outside the workspace/);
});

test('evidence toolchain pin and output path are fail-closed', () => {
  assert.equal(parsePinnedPnpmVersion('pnpm@11.24.0'), '11.24.0');
  for (const value of ['', 'pnpm@latest', 'npm@11.24.0', 'pnpm@11.24']) assert.throws(() => parsePinnedPnpmVersion(value), /exact pnpm/);
  assert.equal(assertPnpmVersion('11.24.0', '11.24.0'), '11.24.0');
  for (const actual of ['', '11.23.0']) assert.throws(() => assertPnpmVersion(actual, '11.24.0'), /version mismatch/);
  assert.throws(() => resolveEvidencePath('evidence.json', '/workspace/repo'), /absolute path/);
  assert.throws(() => resolveEvidencePath('/workspace/repo/evidence.json', '/workspace/repo'), /outside the workspace/);
  assert.equal(resolveEvidencePath('/runner/temp/evidence.json', '/workspace/repo'), '/runner/temp/evidence.json');
  assert.doesNotThrow(() => assertCleanGitStatus('', 'clean commit materialization'));
  assert.throws(() => assertCleanGitStatus(' M package.json\n', 'root tracked workspace'), /root tracked workspace is dirty/);
});

test('evidence is packed from a clean detached commit and rejects tracked root dirtiness', { skip: process.platform === 'win32' ? 'POSIX fixture launcher' : false }, async (context) => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'aas-evidence-test-'));
  context.after(async () => { await import('node:fs/promises').then(({ rm }) => rm(temporary, { recursive: true, force: true })); });
  const repository = path.join(temporary, 'repository');
  const scripts = path.join(repository, 'scripts');
  const pnpmHome = path.join(temporary, 'trusted-pnpm');
  await mkdir(path.join(repository, '.github', 'workflows'), { recursive: true });
  await mkdir(scripts, { recursive: true });
  await mkdir(pnpmHome);
  for (const name of ['ci-head-evidence.mjs', 'evidence-helpers.mjs', 'run-npm.mjs']) {
    await cp(new URL(`../scripts/${name}`, import.meta.url), path.join(scripts, name));
  }
  await writeFile(path.join(repository, 'package.json'), `${JSON.stringify({ name: 'evidence-fixture', version: '1.0.0', packageManager: 'pnpm@11.24.0', files: ['payload.txt'] }, null, 2)}\n`);
  await writeFile(path.join(repository, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  await writeFile(path.join(repository, 'artifacts.json'), '{}\n');
  await writeFile(path.join(repository, '.github', 'workflows', 'verify.yml'), 'name: fixture\n');
  await writeFile(path.join(repository, 'payload.txt'), 'committed payload\n');
  const launcher = path.join(pnpmHome, 'pnpm');
  await writeFile(launcher, '#!/bin/sh\nprintf "11.24.0\\n"\n');
  await chmod(launcher, 0o755);
  const git = (args) => spawnSync('git', args, { cwd: repository, encoding: 'utf8' });
  assert.equal(git(['init', '--quiet']).status, 0);
  assert.equal(git(['add', '.']).status, 0);
  assert.equal(git(['-c', 'user.name=AAS Test', '-c', 'user.email=aas@example.invalid', 'commit', '--quiet', '-m', 'fixture']).status, 0);
  const head = git(['rev-parse', 'HEAD']).stdout.trim();
  const evidencePath = path.join(temporary, 'evidence.json');
  const runEvidence = () => spawnSync(process.execPath, [path.join(scripts, 'ci-head-evidence.mjs')], {
    cwd: repository,
    encoding: 'utf8',
    env: { ...process.env, AAS_EXPECTED_HEAD: head, AAS_EVIDENCE_PATH: evidencePath, PNPM_HOME: pnpmHome }
  });
  const clean = runEvidence();
  assert.equal(clean.status, 0, clean.stderr || clean.stdout);
  const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
  assert.equal(evidence.checkedOutHead, head);
  assert.match(evidence.digests.reproducibleNpmTarball, /^[0-9a-f]{64}$/u);
  await writeFile(path.join(repository, 'payload.txt'), 'dirty payload\n');
  const dirty = runEvidence();
  assert.notEqual(dirty.status, 0);
  assert.match(dirty.stderr, /root tracked workspace is dirty/);
});

test('package inventory rejects Windows case-fold collisions', () => {
  assert.throws(
    () => assertPortablePackageInventory(['README.md', 'readme.md']),
    /case-fold\/NFC-colliding/
  );
});

test('package inventory rejects non-NFC and separator aliases', () => {
  assert.throws(() => assertPortablePackageInventory(['vectors/cafe\u0301.json']), /unstable|non-portable/);
  assert.throws(() => assertPortablePackageInventory(['vectors\\case.json']), /unstable|non-portable/);
});

test('manifest/package paths are lowercase ASCII POSIX and Windows-safe', () => {
  assert.throws(() => assertPortablePackageInventory(['schemas/Index.json']), /unstable/);
  assert.throws(() => assertPortablePackageInventory(['schemas/con.json']), /non-portable/);
  assert.throws(() => assertPortablePackageInventory(['schemas/lpt9.fixture']), /non-portable/);
  assert.throws(() => assertPortablePackageInventory(['schemas/trailing.']), /non-portable/);
  assert.doesNotThrow(() => assertPortablePackageInventory(['README.md', 'LICENSE', 'GOVERNANCE.md', 'schemas/readme.md']));
});

test('package paths enforce byte and segment bounds', () => {
  assert.throws(() => assertPortablePackageInventory([`${'a'.repeat(256)}.json`]), /bounded/);
  assert.throws(() => assertPortablePackageInventory([Array(65).fill('a').join('/')]), /bounded/);
  assert.throws(() => assertPortablePackageInventory([`${'a'.repeat(250)}/${'b'.repeat(250)}/`.repeat(9) + 'x']), /bounded/);
});

test('shared portable-path profile enforces Unicode, UTF-8, Windows, and collection rules', () => {
  assert.doesNotThrow(() => assertPortablePath('src/café/file.json'));
  for (const invalid of [
    'src/cafe\u0301.json', 'src/con.txt', 'src/file. ', 'src/a\u0001b',
    'src/a\u202eb', String.raw`src\file.json`, 'C:/file.json', '/absolute/file.json'
    , `src/${String.fromCharCode(0xd800)}`
  ]) assert.throws(() => assertPortablePath(invalid), /invalid portable path/, invalid);
  assert.throws(() => assertPortablePath(`src/${'é'.repeat(128)}`), /255 UTF-8 bytes/);
  assert.throws(() => assertPortablePathCollection(['src/STRASSE', 'src/straße']), /colliding/);
});

test('post-schema document validation closes every identity-bearing path collection', () => {
  const artifact = { aasIdentity: 'aas:v0:sha256:' + 'a'.repeat(64), contentDigest: 'sha256:' + 'b'.repeat(64), byteLength: 1, mediaType: 'application/json' };
  const snapshot = { pathProfile: {}, entries: [{ path: 'src/STRASSE', artifact }, { path: 'src/straße', artifact }] };
  const overlay = { baseSnapshotAasIdentity: 'aas:v0:sha256:' + 'c'.repeat(64), operations: [{ op: 'add', path: 'src/K', contentAasIdentity: artifact.aasIdentity }, { op: 'delete', path: 'src/K' }] };
  const policy = { scope: 'src/FF', rules: [], exceptions: [{ scope: `src/${String.fromCharCode(0xd800)}` }], provenance: [] };
  const binding = { scope: { repositoryRoot: 'src', path: 'src/' + String.fromCharCode(0xd800) }, rolloutScope: 'all' };
  for (const value of [snapshot, overlay, policy, binding]) assert.throws(() => assertIdentityDocumentPathInvariants(value), /portable path|colliding/);
});

test('semantic path references may repeat across different rules', () => {
  const pathProfile = { version: '1', id: 'agent-architecture-portable-path-unicode17@1', aasIdentity: 'aas:v0:sha256:' + 'c'.repeat(64) };
  const policy = {
    scope: 'src', pathProfile, rules: [{ id: 'rule-1' }, { id: 'rule-2' }], provenance: [],
    exceptions: [{ ruleId: 'rule-1', scope: 'src/shared', pathProfile }, { ruleId: 'rule-2', scope: 'src/shared', pathProfile }]
  };
  assert.doesNotThrow(() => assertIdentityDocumentPathInvariants(policy));
});

test('governed exception path profiles, standalone bounds, and semantic collision closure fail closed', () => {
  const pathProfile = { version: '1', id: 'agent-architecture-portable-path-unicode17@1', aasIdentity: 'aas:v0:sha256:' + 'c'.repeat(64) };
  const baseException = { ruleId: 'rule-1', scope: 'src/path', pathProfile, validForRevision: 'aas:v0:sha256:' + 'a'.repeat(64) };
  for (const scope of ['src/cafe\u0301', `src/${'é'.repeat(128)}`]) {
    assert.throws(() => assertIdentityDocumentPathInvariants({ ...baseException, scope }), /portable path/);
  }
  const substituted = { ...pathProfile, aasIdentity: 'aas:v0:sha256:' + 'd'.repeat(64) };
  const policy = { scope: 'src', pathProfile, rules: [], provenance: [], exceptions: [{ ...baseException, pathProfile: substituted }] };
  assert.throws(() => assertIdentityDocumentPathInvariants(policy), /path profile differs/);
  const collidingPolicy = { ...policy, exceptions: [{ ...baseException, scope: 'src/child' }, { ...baseException, ruleId: 'rule-2', scope: 'SRC/CHILD' }] };
  assert.throws(() => assertIdentityDocumentPathInvariants(collidingPolicy), /colliding/);
  const binding = { scope: { repositoryRoot: 'src', path: 'SRC' }, rolloutScope: 'all', pathProfile };
  assert.throws(() => assertIdentityDocumentPathInvariants(binding), /colliding/);
});

test('vendored Unicode 17 C+F case-fold data has pinned provenance and derived bytes', async () => {
  const bytes = await readFile(new URL('../lib/unicode-case-fold-17.mjs', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '84c81c250d57fac6fa9937b4379451bd6f421242cba9e5e4b80a3b0ad29c0f2e');
  assert.match(bytes.toString('utf8'), /Source SHA-256: ff8d8fefbf123574205085d6714c36149eb946d717a0c585c27f0f4ef58c4183/);
  assert.equal(portablePathCollisionKey('İ'), 'i\u0307');
  assert.notEqual(portablePathCollisionKey('I'), portablePathCollisionKey('ı'), 'Turkic T fold must be excluded');
});

test('vendored Unicode 17 NFC is host-independent, version-sensitive, and includes Hangul', async () => {
  const bytes = await readFile(new URL('../lib/unicode-normalization-17.mjs', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '48dec21f49f02b2672a0308dafe3a591b5c9fcb7f8a5377c08b4b75d75a34ab4');
  assert.throws(() => assertPortablePath('src/a\u0315\u{1e6e3}'), /Unicode 17 NFC/);
  assert.doesNotThrow(() => assertPortablePath('src/a\u{1e6e3}\u0315'));
  assert.equal(portablePathCollisionKey('\u1100\u1161\u11a8'), '\uac01');
});
