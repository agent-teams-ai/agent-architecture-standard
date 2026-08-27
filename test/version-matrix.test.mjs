import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseStrictJson } from '../lib/strict-json.mjs';
const matrix = parseStrictJson(await readFile(new URL('../version-matrix.json', import.meta.url)));
const versionRegistry = parseStrictJson(await readFile(new URL('../registries/envelope-versions.json', import.meta.url)));
const ranks = new Map(versionRegistry.entries.map((entry) => [entry.id, entry.orderingRank]));
const compare = (left, right) => ranks.get(left) - ranks.get(right);
const select = ({ reader, writer, pin }) => {
  if (reader.some((version) => !ranks.has(version)) || writer.some((version) => !ranks.has(version)) || (pin !== null && !ranks.has(pin))) return null;
  const mutual = reader.filter((version) => writer.includes(version));
  if (pin !== null) return mutual.includes(pin) ? pin : null;
  return mutual.sort(compare).at(-1) ?? null;
};
test('checked-in private provisional negotiation matrix uses registry-owned ordering', () => {
  assert.equal(matrix.selection.orderingAuthority, 'registries/envelope-versions.json');
  assert.equal(ranks.size, versionRegistry.entries.length);
  for (const item of matrix.cases) assert.equal(select(item), item.selected, item.id);
  assert.equal(select({ reader: ['9.9'], writer: ['9.9'], pin: null }), null);
  assert.equal(matrix.identityRules.constructorsPresent, false);
  assert.match(matrix.identityRules.historicalDecoding, /retain original schema/);
  assert.match(matrix.identityRules.withdrawnProfile, /historical interpretation retained/);
});
