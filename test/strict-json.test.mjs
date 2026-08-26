import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseStrictJson } from '../lib/strict-json.mjs';

const reject = async (file, code, limits) => {
  const bytes = await readFile(new URL(`../vectors/json/negative/${file}`, import.meta.url));
  assert.throws(() => parseStrictJson(bytes, limits), (error) => error.code === code);
};
test('safe objects use a null prototype recursively', async () => {
  const parsed = parseStrictJson(await readFile(new URL('../vectors/json/positive/null-prototype.json', import.meta.url)));
  assert.equal(Object.getPrototypeOf(parsed), null);
  assert.equal(Object.getPrototypeOf(parsed.safe), null);
});
test('duplicate decoded keys are rejected', async () => {
  await reject('duplicate-key.json', 'aas.json.duplicate-key');
  await reject('duplicate-escaped-key.json', 'aas.json.duplicate-key');
});
test('prototype-sensitive keys are rejected', () => reject('prototype.json', 'aas.json.unsafe-key'));
test('non-integer and negative-zero numbers are rejected', async () => {
  await reject('fraction.json', 'aas.json.invalid-number');
  await reject('negative-zero.json', 'aas.json.invalid-number');
});
test('depth and encoded-size ceilings are deterministic', async () => {
  await reject('depth.json', 'aas.json.depth-exceeded', { maxBytes: 1000, maxDepth: 3 });
  const exact = Buffer.from('{"v":1}');
  assert.equal(parseStrictJson(exact, { maxBytes: exact.byteLength, maxDepth: 1 }).v, 1);
  assert.throws(() => parseStrictJson(exact, { maxBytes: exact.byteLength - 1, maxDepth: 1 }), (error) => error.code === 'aas.json.input-too-large');
  assert.doesNotThrow(() => parseStrictJson(Buffer.from('[[[]]]'), { maxBytes: 6, maxDepth: 3 }));
  assert.throws(() => parseStrictJson(Buffer.from('[[[[]]]]'), { maxBytes: 8, maxDepth: 3 }), (error) => error.code === 'aas.json.depth-exceeded');
});
test('BOM and invalid UTF-8 are rejected', async () => {
  const fixture = await readFile(new URL('../vectors/json/negative/bom.json', import.meta.url));
  assert.throws(() => parseStrictJson(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), fixture])), (error) => error.code === 'aas.json.invalid-utf8');
  assert.throws(() => parseStrictJson(Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xff, 0x7d])), (error) => error.code === 'aas.json.invalid-utf8');
});
test('raw-byte roots, surrogates, trailing roots, and integer boundaries are exact', async () => {
  assert.throws(() => parseStrictJson('{}'), (error) => error.code === 'aas.json.raw-bytes-required');
  await reject('lone-surrogate.json', 'aas.json.invalid-syntax');
  await reject('trailing-root.json', 'aas.json.invalid-syntax');
  await reject('unsafe-integer.json', 'aas.json.invalid-number');
  const parsed = parseStrictJson(await readFile(new URL('../vectors/json/positive/integer-boundaries.json', import.meta.url)));
  assert.equal(parsed.minimum, Number.MIN_SAFE_INTEGER);
  assert.equal(parsed.maximum, Number.MAX_SAFE_INTEGER);
});
