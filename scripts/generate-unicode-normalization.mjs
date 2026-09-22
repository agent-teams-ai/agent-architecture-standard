import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sourceDirectory = process.argv[2];
const output = process.argv[3] ?? new URL('../lib/unicode-normalization-17.mjs', import.meta.url);
if (!sourceDirectory) {throw new Error('usage: node scripts/generate-unicode-normalization.mjs UCD-17-DIRECTORY [OUTPUT]');}

const sources = Object.freeze({
  'UnicodeData.txt': '2e1efc1dcb59c575eedf5ccae60f95229f706ee6d031835247d843c11d96470c',
  'DerivedNormalizationProps.txt': '71fd6a206a2c0cdd41feb6b7f656aa31091db45e9cedc926985d718397f9e488',
  'CompositionExclusions.txt': '2f239196ef3b5b61db5cc476e9bd80f534d15aa1b74e1be1dea5d042a344c85f',
  'CaseFolding.txt': 'ff8d8fefbf123574205085d6714c36149eb946d717a0c585c27f0f4ef58c4183'
});
const texts = new Map();
for (const [name, expected] of Object.entries(sources)) {
  const bytes = await readFile(path.join(sourceDirectory, name));
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expected) {throw new Error(`${name} digest mismatch: ${actual}`);}
  texts.set(name, bytes.toString('utf8'));
}
const exclusions = new Set();
for (const line of texts.get('CompositionExclusions.txt').split(/\r?\n/u)) {
  const match = /^([0-9A-F]+)\s*(?:#|$)/u.exec(line);
  if (match) {exclusions.add(Number.parseInt(match[1], 16));}
}
for (const line of texts.get('DerivedNormalizationProps.txt').split(/\r?\n/u)) {
  const match = /^([0-9A-F]+)(?:\.\.([0-9A-F]+))?\s*;\s*Full_Composition_Exclusion\b/u.exec(line);
  if (match) {for (let cp = Number.parseInt(match[1], 16), end = Number.parseInt(match[2] ?? match[1], 16); cp <= end; cp += 1) {exclusions.add(cp);}}
}

const combining = [], decomposition = [], composition = [];
for (const line of texts.get('UnicodeData.txt').split(/\r?\n/u)) {
  if (!line) {continue;}
  const fields = line.split(';');
  const cp = Number.parseInt(fields[0], 16);
  const ccc = Number.parseInt(fields[3], 10);
  if (ccc !== 0) {combining.push([cp, ccc]);}
  const raw = fields[5];
  if (!raw || raw.startsWith('<')) {continue;}
  const mapping = raw.split(' ').map((item) => Number.parseInt(item, 16));
  decomposition.push([cp, mapping]);
  if (mapping.length === 2 && !exclusions.has(cp)) {composition.push([mapping[0], mapping[1], cp]);}
}
const body = `// Generated from the digest-pinned Unicode 17.0.0 UCD sources.\n// UnicodeData ${sources['UnicodeData.txt']}; DerivedNormalizationProps ${sources['DerivedNormalizationProps.txt']}\n// CompositionExclusions ${sources['CompositionExclusions.txt']}; CaseFolding ${sources['CaseFolding.txt']}\n// Compact canonical combining, decomposition, and composition records. Hangul is algorithmic. Do not edit.\nexport const UNICODE_NORMALIZATION_17 = ${JSON.stringify({ combining, decomposition, composition })};\n`;
await writeFile(output, body, 'utf8');
