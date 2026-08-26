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
