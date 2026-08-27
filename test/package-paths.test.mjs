import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPortablePackageInventory } from '../scripts/package-paths.mjs';
import { runNpmSync } from '../scripts/run-npm.mjs';

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
  assert.doesNotThrow(() => assertPortablePackageInventory(['README.md', 'LICENSE', 'schemas/readme.md']));
});
