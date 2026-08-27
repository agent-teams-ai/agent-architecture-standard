import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPortablePackageInventory } from '../scripts/package-paths.mjs';
import { assertPortablePath, assertPortablePathCollection, portablePathCollisionKey } from '../lib/portable-path.mjs';
import { runNpmSync, runPnpmVersionSync } from '../scripts/run-npm.mjs';
import { assertIdentityDocumentPathInvariants } from '../lib/document-validation.mjs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

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
    spawnSync(command, args, options) {
      invocation = { command, args, options };
      return { status: 0, signal: null, stdout: '11.24.0\r\n', stderr: '' };
    }
  });
  assert.equal(version, '11.24.0');
  assert.deepEqual(invocation, {
    command: String.raw`C:\Windows\System32\cmd.exe`,
    args: ['/d', '/s', '/c', 'pnpm.cmd --version'],
    options: { encoding: 'utf8' }
  });
});

test('pnpm version runs directly on POSIX and requires version output', () => {
  let invocation;
  assert.throws(() => runPnpmVersionSync({}, {
    platform: 'linux',
    spawnSync(command, args) {
      invocation = { command, args };
      return { status: 0, signal: null, stdout: '', stderr: '' };
    }
  }), /produced no version/);
  assert.deepEqual(invocation, { command: 'pnpm', args: ['--version'] });
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
  const policy = {
    scope: 'src', rules: [{ id: 'rule-1' }, { id: 'rule-2' }], provenance: [],
    exceptions: [{ ruleId: 'rule-1', scope: 'src/shared' }, { ruleId: 'rule-2', scope: 'src/shared' }]
  };
  assert.doesNotThrow(() => assertIdentityDocumentPathInvariants(policy));
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
