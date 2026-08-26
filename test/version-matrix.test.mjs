import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const matrix = JSON.parse(await readFile(new URL('../version-matrix.json', import.meta.url), 'utf8'));
const versionRegistry = JSON.parse(await readFile(new URL('../registries/envelope-versions.json', import.meta.url), 'utf8'));
const ranks = new Map(versionRegistry.entries.map((entry) => [entry.id, entry.orderingRank]));
const compare = (left, right) => ranks.get(left) - ranks.get(right);
const select = ({ reader, writer, pin }) => {
  const mutual = reader.filter((version) => writer.includes(version));
  if (pin !== null) return mutual.includes(pin) ? pin : null;
  return mutual.sort(compare).at(-1) ?? null;
};
test('checked-in private provisional negotiation matrix uses registry-owned ordering', () => {
  assert.equal(matrix.selection.orderingAuthority, 'registries/envelope-versions.json');
  assert.equal(ranks.size, versionRegistry.entries.length);
  for (const item of matrix.cases) assert.equal(select(item), item.selected, item.id);
  assert.equal(matrix.identityRules.constructorsPresent, false);
  assert.match(matrix.identityRules.historicalDecoding, /retain original schema/);
  assert.match(matrix.identityRules.withdrawnProfile, /historical interpretation retained/);
});
