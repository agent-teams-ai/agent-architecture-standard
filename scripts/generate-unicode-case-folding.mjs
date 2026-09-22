import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_SOURCE_SHA256 = 'ff8d8fefbf123574205085d6714c36149eb946d717a0c585c27f0f4ef58c4183';
const source = process.argv[2];
if (!source) {throw new Error('usage: node scripts/generate-unicode-case-folding.mjs CaseFolding-17.0.0.txt');}
const bytes = await readFile(source);
const digest = createHash('sha256').update(bytes).digest('hex');
if (digest !== EXPECTED_SOURCE_SHA256) {throw new Error(`Unicode CaseFolding source digest mismatch: ${digest}`);}
const text = bytes.toString('utf8');
if (!text.includes('# CaseFolding-17.0.0.txt') || !text.includes('# Date: 2025-07-30')) {throw new Error('Unicode CaseFolding 17.0.0 provenance header mismatch');}

// Default full folding uses C and F records, with F taking precedence.  Turkic
// T records are deliberately excluded by the normative portable-path profile.
const common = new Map(), full = new Map();
for (const line of text.split(/\r?\n/u)) {
  const match = /^([0-9A-F]+); ([CFT]); ([0-9A-F ]+);/u.exec(line);
  if (!match || match[2] === 'T') {continue;}
  (match[2] === 'F' ? full : common).set(Number.parseInt(match[1], 16), match[3].trim().split(' ').map((item) => Number.parseInt(item, 16)));
}
for (const [codePoint, mapping] of full) {common.set(codePoint, mapping);}
const records = [...common].toSorted(([left], [right]) => left - right);
const body = JSON.stringify(records.map(([codePoint, mapping]) => [codePoint.toString(16), mapping.map((item) => item.toString(16)).join(' ')]));
const output = `// Generated from Unicode 17.0.0 CaseFolding.txt (2025-07-30).\n// Source SHA-256: ${EXPECTED_SOURCE_SHA256}\n// Statuses: C+F, F precedence; Turkic T excluded. Do not edit.\nexport const UNICODE_CASE_FOLD_17 = ${body};\n`;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await writeFile(path.join(root, 'lib/unicode-case-fold-17.mjs'), output, 'utf8');
