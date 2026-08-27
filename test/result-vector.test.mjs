import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { assertResultInvariants } from '../lib/result-validation.mjs';
import { parseStrictJson } from '../lib/strict-json.mjs';

const canonicalize = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
};
const u32be = (value) => { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(value); return bytes; };
const u64be = (value) => { const bytes = Buffer.alloc(8); bytes.writeBigUInt64BE(BigInt(value)); return bytes; };

test('result self-identity vector includes the complete closed result projection', async () => {
  const result = parseStrictJson(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
  assert.doesNotThrow(() => assertResultInvariants(result));
  const expected = result.aasIdentity;
  delete result.aasIdentity;
  for (const resolution of result.resolutions) delete resolution.diagnostic.resultAasIdentity;
  const payload = Buffer.from(canonicalize(result));
  assert.equal(payload.byteLength, 2716);
  assert.equal(`sha256:${createHash('sha256').update(payload).digest('hex')}`, 'sha256:52a36a4fc93d81435f6084b9835d19c9fa0ddab96e6f85d7d1c21738d7262fd1');
  const magic = Buffer.from('AAS-ID');
  const domain = Buffer.from('aas.result.v0');
  const profile = Buffer.from('agent-architecture-canonical-json-rfc8785@0');
  const frame = Buffer.concat([u32be(magic.length), magic, u32be(domain.length), domain, u32be(profile.length), profile, u64be(payload.length), payload]);
  assert.equal(frame.byteLength, 2798);
  assert.equal(expected, `aas:v0:sha256:${createHash('sha256').update(frame).digest('hex')}`);
});

test('result cross-field invariants reject identity, coverage, and count inconsistencies', async () => {
  const original = parseStrictJson(await readFile(new URL('../vectors/schema/positive/result.json', import.meta.url)));
  const mutations = [
    (value) => { value.resolutions[0].diagnostic.resultAasIdentity = 'aas:v0:sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'; },
    (value) => { value.coverage.push({ ...value.coverage[0] }); },
    (value) => { value.coverage = value.coverage.filter((item) => item.stage !== 'overlay-reevaluation'); },
    (value) => { value.coverage[0].unknown = 1; },
    (value) => { value.resolutions[0].diagnostic.severityCounts.info = 1; },
    (value) => { value.realizedCounters.diagnostics = 1; }
  ];
  for (const mutate of mutations) {
    const value = structuredClone(original); mutate(value);
    assert.throws(() => assertResultInvariants(value), /invalid AAS result/);
  }
});
