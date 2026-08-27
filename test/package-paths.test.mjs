import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPortablePackageInventory } from '../scripts/package-paths.mjs';

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
