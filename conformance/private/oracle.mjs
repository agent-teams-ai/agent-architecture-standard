// Independently authored private oracle. Expectations and success digests are
// literal review data, not computed by the candidate or a repository parser.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, '../..');
const corpusPath = path.join(workspace, 'vectors/json/corpus.json');

const expectations = [
  ['raw-bytes-required', 'aas.json.raw-bytes-required', null],
  ['null-prototype', 'none', 'sha256:91c264c00f325ecd3eb3df420c886fec49ff8b23d79ddd767efccd193ed79aeb'],
  ['prototype-keys-inert', 'none', 'sha256:c1c554f727fa6a08fe24a164a089f4d3a6eec072ce309c3aacdde415d5badcb0'],
  ['integer-spellings', 'none', 'sha256:7f72396a2128e7dbe0eec9f96e3062bbb66a931f66607c76a898c5ae11ee1b9a'],
  ['duplicate-key', 'aas.json.duplicate-key', null],
  ['duplicate-escaped-key', 'aas.json.duplicate-key', null],
  ['fraction', 'aas.json.invalid-number', null],
  ['negative-zero', 'aas.json.invalid-number', null],
  ['unsafe-integer', 'aas.json.invalid-number', null],
  ['depth', 'aas.json.depth-exceeded', null],
  ['input-too-large', 'aas.json.input-too-large', null],
  ['bom', 'aas.json.invalid-utf8', null],
  ['lone-surrogate', 'aas.json.invalid-syntax', null],
  ['trailing-root', 'aas.json.invalid-syntax', null],
  ['rounded-safe-maximum', 'aas.json.invalid-number', null],
  ['rounded-one', 'aas.json.invalid-number', null],
  ['exact-scaled-integer', 'none', 'sha256:6a4ef24cb01aa0e97da4186c067128b828532db703db8872fa736a0cc0b363b1'],
  ['large-exact-safe-integer-spelling', 'none', 'sha256:6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b'],
];

const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export async function loadOracleCases() {
  const corpusBytes = await readFile(corpusPath);
  const corpus = JSON.parse(corpusBytes);
  if (corpus.cases.length !== 18 || expectations.length !== 18) {throw new Error('oracle-corpus-cardinality');}
  const result = [];
  for (let index = 0; index < expectations.length; index += 1) {
    const [caseId, diagnostic, valueDigest] = expectations[index];
    const item = corpus.cases[index];
    if (item.caseId !== caseId || item.expected.diagnostic !== diagnostic) {throw new Error('oracle-corpus-drift');}
    let bytes;
    let form = 'bytes';
    if (item.input.constructedToken) {
      const { prefix, repeat, suffix } = item.input.constructedToken;
      if (repeat.text !== '0' || repeat.count !== 100001) {throw new Error('oracle-construction-drift');}
      bytes = Buffer.from(`${prefix}${repeat.text.repeat(repeat.count)}${suffix}`);
    } else {
      const resolved = path.resolve(workspace, item.input.reference);
      const vectorRoot = `${path.join(workspace, 'vectors/json')}${path.sep}`;
      if (!resolved.startsWith(vectorRoot)) {throw new Error('oracle-reference-outside-json-vectors');}
      bytes = await readFile(resolved);
      if (item.input.prefixHex) {bytes = Buffer.concat([Buffer.from(item.input.prefixHex, 'hex'), bytes]);}
      if (item.input.form === 'decoded-text') {form = 'decoded-text';}
    }
    result.push(Object.freeze({
      caseId,
      diagnostic,
      valueDigest,
      form,
      bytes,
      limits: Object.freeze({ maxBytes: item.limits.maxBytes, maxDepth: item.limits.maxDepth }),
    }));
  }
  return Object.freeze({
    cases: Object.freeze(result),
    corpusDigest: sha256(corpusBytes),
  });
}
