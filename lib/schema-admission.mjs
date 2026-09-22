import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { parseStrictJson } from './strict-json.mjs';
import { copyWireBytes, parseAdmittedSchemaBytes } from './schema-admission-core.mjs';

const require = createRequire(import.meta.url);
const ids = Object.freeze({
  bindingSet: 'identity-documents.schema.json#/$defs/bindingSet', binding: 'policy.schema.json#/$defs/binding',
  effectivePolicy: 'policy.schema.json#/$defs/effectivePolicy', profile: 'identity-documents.schema.json#/$defs/profile',
  analyzer: 'identity-documents.schema.json#/$defs/analyzer', promotionRecord: 'identity-documents.schema.json#/$defs/promotionRecord',
  request: 'envelope.schema.json#/$defs/request', analysisKey: 'identity-documents.schema.json#/$defs/analysisKey',
  targetSelection: 'identity-documents.schema.json#/$defs/targetSelection', result: 'envelope.schema.json#/$defs/result'
});
const MAX_SCHEMA_ERRORS = 3, MAX_SCHEMA_FAILURE_LENGTH = 512;
let validators;

const getValidators = () => {
  if (validators) {return validators;}
  const Ajv2020 = require('ajv/dist/2020.js').default;
  const schemaDirectory = new URL('../schemas/', import.meta.url);
  const schemas = readdirSync(schemaDirectory).filter((name) => name.endsWith('.schema.json'))
    .map((name) => parseStrictJson(readFileSync(new URL(name, schemaDirectory)), { maxBytes: 4_194_304, maxDepth: 128 }));
  const ajv = new Ajv2020({ allErrors: false, strict: true, allowUnionTypes: true, validateFormats: false });
  ajv.addKeyword({ keyword: 'x-aas-status', schemaType: 'string', valid: true });
  for (const schema of schemas) {ajv.addSchema(schema);}
  validators = new Map(Object.entries(ids).map(([name, ref]) => [name, ajv.getSchema(`https://schemas.aas.invalid/private/v0/${ref}`)]));
  return validators;
};
const schemaFailure = (label, errors) => {
  const detail = (errors ?? []).slice(0, MAX_SCHEMA_ERRORS).map((error) => {
    const location = error.instancePath || '/'; return `${location} ${error.message ?? `failed ${error.keyword}`}`;
  }).join('; ') || 'validation failed';
  return `invalid AAS ${label} schema: ${detail}`.slice(0, MAX_SCHEMA_FAILURE_LENGTH);
};
export function assertSchema(value, definition, label = definition) {
  const validate = getValidators().get(definition);
  if (!validate) {throw new TypeError(`unknown AAS schema definition: ${definition}`);}
  if (!validate(value)) {throw new TypeError(schemaFailure(label, validate.errors));}
  return value;
}
export { copyWireBytes };
export const parseSchemaBytes = (value, definition, label, limits) => parseAdmittedSchemaBytes(value, definition, label, limits, assertSchema);
