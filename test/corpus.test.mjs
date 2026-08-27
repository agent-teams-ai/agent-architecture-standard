import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseStrictJson } from '../lib/strict-json.mjs';
import { assertIdentityDocumentPathInvariants } from '../lib/document-validation.mjs';

const root = path.resolve(import.meta.dirname, '..');
const schemaNames = (await readdir(path.join(root, 'schemas'))).filter((name) => name.endsWith('.schema.json'));
const schemas = await Promise.all(schemaNames.map(async (name) => parseStrictJson(await readFile(path.join(root, 'schemas', name)))));
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true, validateFormats: false });
ajv.addKeyword({ keyword: 'x-aas-status', schemaType: 'string', valid: true });
for (const schema of schemas) ajv.addSchema(schema);
const corpus = parseStrictJson(await readFile(path.join(root, 'vectors/schema/corpus.json')));
test('positive and negative schema corpus has exact expected dispositions', async () => {
  const seen = new Set();
  const realizedCases = new Map();
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
    realizedCases.set(item.caseId, instance);
    const validate = ajv.getSchema(item.expected.schema);
    assert(validate, `unknown schema ID in corpus: ${item.expected.schema}`);
    // AJV's object-valued uniqueItems helper assumes Object.prototype.valueOf;
    // validate an equivalent ordinary clone after strict parsing has succeeded.
    instance = structuredClone(instance);
    let valid = validate(instance);
    let diagnostic = valid ? 'none' : 'schema-validation-failed';
    if (valid) {
      try { assertIdentityDocumentPathInvariants(instance, item.caseId); }
      catch { valid = false; diagnostic = 'portable-path-validation-failed'; }
    }
    assert.equal(valid, item.expected.valid, `${item.caseId}: ${ajv.errorsText(validate.errors)}`);
    assert.equal(item.expected.diagnostic, diagnostic, `${item.caseId}: diagnostic`);
  }
  const coveredSchemas = new Set(corpus.cases.map((item) => item.expected.schema));
  for (const schema of [...corpus.coverage.publicRoots, ...corpus.coverage.materialDefinitions]) assert(coveredSchemas.has(schema), `uncovered declared schema surface: ${schema}`);
  for (const schema of corpus.coverage.publicRoots) {
    const rootCases = corpus.cases.filter((item) => item.expected.schema === schema);
    assert(rootCases.some((item) => item.expected.valid), `public root lacks positive case: ${schema}`);
    assert(rootCases.some((item) => !item.expected.valid), `public root lacks negative case: ${schema}`);
  }
  for (const schema of corpus.coverage.materialDefinitions) {
    const cases = corpus.cases.filter((item) => item.expected.schema === schema);
    assert(cases.some((item) => item.expected.valid), `material definition lacks a positive case: ${schema}`);
    const negatives = cases.filter((item) => !item.expected.valid);
    assert(negatives.length > 0, `material definition lacks a negative case: ${schema}`);
    assert(negatives.some((item) => {
      const instance = realizedCases.get(item.caseId);
      return instance !== null && typeof instance === 'object' && !Array.isArray(instance) && !/rejects? a scalar/iu.test(item.rationale);
    }), `material definition lacks a substantive object-shaped negative case: ${schema}`);
  }
  const discoveredConditionals = new Set();
  const visit = (value, schemaId, pointer = '') => {
    if (!value || typeof value !== 'object') return;
    if (value.if && value.then) discoveredConditionals.add(`${schemaId}#${pointer}`);
    for (const [key, child] of Object.entries(value)) visit(child, schemaId, `${pointer}/${key.replace(/~/gu, '~0').replace(/\//gu, '~1')}`);
  };
  for (const schema of schemas) visit(schema, schema.$id);
  assert.deepEqual(new Set(Object.keys(corpus.coverage.conditionals)), discoveredConditionals, 'conditional branch catalog must be exhaustive');
  for (const [conditional, caseIds] of Object.entries(corpus.coverage.conditionals)) {
    const cases = caseIds.map((caseId) => corpus.cases.find((item) => item.caseId === caseId));
    assert(cases.every(Boolean), `conditional cites an unknown case: ${conditional}`);
    assert(cases.some((item) => item.expected.valid), `conditional lacks a positive case: ${conditional}`);
    assert(cases.some((item) => !item.expected.valid), `conditional lacks a negative case: ${conditional}`);
    assert(cases.every((item) => { const instance = realizedCases.get(item.caseId); return instance !== null && typeof instance === 'object'; }), `conditional uses a generic scalar case: ${conditional}`);
  }
});
