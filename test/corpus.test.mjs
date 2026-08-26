import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const schemaNames = (await readdir(path.join(root, 'schemas'))).filter((name) => name.endsWith('.schema.json'));
const schemas = await Promise.all(schemaNames.map(async (name) => JSON.parse(await readFile(path.join(root, 'schemas', name), 'utf8'))));
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true, validateFormats: false });
ajv.addKeyword({ keyword: 'x-aas-status', schemaType: 'string', valid: true });
for (const schema of schemas) ajv.addSchema(schema);
const corpus = JSON.parse(await readFile(path.join(root, 'vectors/schema/corpus.json'), 'utf8'));
test('positive and negative schema corpus has exact expected dispositions', async () => {
  const seen = new Set();
  for (const item of corpus.cases) {
    assert(!seen.has(item.id), `duplicate case ID: ${item.id}`); seen.add(item.id);
    const instance = JSON.parse(await readFile(path.join(root, item.path), 'utf8'));
    const validate = ajv.getSchema(item.schema);
    assert(validate, `unknown schema ID in corpus: ${item.schema}`);
    assert.equal(validate(instance), item.valid, `${item.id}: ${ajv.errorsText(validate.errors)}`);
  }
});
