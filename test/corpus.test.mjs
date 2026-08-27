import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseStrictJson } from '../lib/strict-json.mjs';

const root = path.resolve(import.meta.dirname, '..');
const schemaNames = (await readdir(path.join(root, 'schemas'))).filter((name) => name.endsWith('.schema.json'));
const schemas = await Promise.all(schemaNames.map(async (name) => parseStrictJson(await readFile(path.join(root, 'schemas', name)))));
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true, validateFormats: false });
ajv.addKeyword({ keyword: 'x-aas-status', schemaType: 'string', valid: true });
for (const schema of schemas) ajv.addSchema(schema);
const corpus = parseStrictJson(await readFile(path.join(root, 'vectors/schema/corpus.json')));
test('positive and negative schema corpus has exact expected dispositions', async () => {
  const seen = new Set();
  for (const item of corpus.cases) {
    assert(!seen.has(item.caseId), `duplicate case ID: ${item.caseId}`); seen.add(item.caseId);
    assert.equal(typeof item.requirement, 'string');
    assert.equal(typeof item.rationale, 'string');
    assert.equal(item.expected.version, corpus.schemaVersion);
    assert(Number.isSafeInteger(item.limits.maxInputBytes) && Number.isSafeInteger(item.limits.maxDepth));
    let instance = parseStrictJson(await readFile(path.join(root, item.input.reference)));
    if (item.input.pointer) {
      for (const segment of item.input.pointer.split('/').slice(1)) instance = instance[segment.replace(/~1/g, '/').replace(/~0/g, '~')];
    }
    if (item.input.mutation) {
      instance = structuredClone(instance);
      const segments = item.input.mutation.pointer.split('/').slice(1).map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
      const member = segments.pop();
      let parent = instance;
      for (const segment of segments) parent = parent[segment];
      parent[member] = item.input.mutation.value;
    }
    const validate = ajv.getSchema(item.expected.schema);
    assert(validate, `unknown schema ID in corpus: ${item.expected.schema}`);
    // AJV's object-valued uniqueItems helper assumes Object.prototype.valueOf;
    // validate an equivalent ordinary clone after strict parsing has succeeded.
    instance = structuredClone(instance);
    assert.equal(validate(instance), item.expected.valid, `${item.caseId}: ${ajv.errorsText(validate.errors)}`);
    assert.equal(item.expected.diagnostic, item.expected.valid ? 'none' : 'schema-validation-failed');
  }
  const coveredSchemas = new Set(corpus.cases.map((item) => item.expected.schema));
  for (const schema of [...corpus.coverage.publicRoots, ...corpus.coverage.materialDefinitions]) assert(coveredSchemas.has(schema), `uncovered declared schema surface: ${schema}`);
  for (const schema of corpus.coverage.publicRoots) {
    const rootCases = corpus.cases.filter((item) => item.expected.schema === schema);
    assert(rootCases.some((item) => item.expected.valid), `public root lacks positive case: ${schema}`);
    assert(rootCases.some((item) => !item.expected.valid), `public root lacks negative case: ${schema}`);
  }
});
