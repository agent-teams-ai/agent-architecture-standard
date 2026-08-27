import { readFileSync, readdirSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseStrictJson } from './strict-json.mjs';

const schemaDirectory = new URL('../schemas/', import.meta.url);
const schemas = readdirSync(schemaDirectory).filter((name) => name.endsWith('.schema.json'))
  .map((name) => parseStrictJson(readFileSync(new URL(name, schemaDirectory)), { maxBytes: 4_194_304, maxDepth: 128 }));
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true, validateFormats: false });
ajv.addKeyword({ keyword: 'x-aas-status', schemaType: 'string', valid: true });
for (const schema of schemas) ajv.addSchema(schema);

const ids = Object.freeze({
  bindingSet: 'identity-documents.schema.json#/$defs/bindingSet', binding: 'policy.schema.json#/$defs/binding',
  effectivePolicy: 'policy.schema.json#/$defs/effectivePolicy', profile: 'identity-documents.schema.json#/$defs/profile',
  analyzer: 'identity-documents.schema.json#/$defs/analyzer', promotionRecord: 'identity-documents.schema.json#/$defs/promotionRecord',
  request: 'envelope.schema.json#/$defs/request', analysisKey: 'identity-documents.schema.json#/$defs/analysisKey',
  targetSelection: 'identity-documents.schema.json#/$defs/targetSelection', result: 'envelope.schema.json#/$defs/result'
});
const validators = new Map(Object.entries(ids).map(([name, ref]) => [name,
  ajv.getSchema(`https://schemas.aas.invalid/private/v0/${ref}`)]));

export function assertSchema(value, definition, label = definition) {
  const validate = validators.get(definition);
  if (!validate) throw new TypeError(`unknown AAS schema definition: ${definition}`);
  if (!validate(value)) throw new TypeError(`invalid AAS ${label} schema: ${ajv.errorsText(validate.errors, { separator: '; ' })}`);
  return value;
}

export function copyWireBytes(value, label) {
  if (!ArrayBuffer.isView(value) || !(value instanceof Uint8Array) || value.buffer instanceof SharedArrayBuffer) {
    throw new TypeError(`${label} must be Uint8Array backed by a non-shared ArrayBuffer`);
  }
  try { return Uint8Array.prototype.slice.call(value); }
  catch { throw new TypeError(`${label} must be a cloneable non-proxy Uint8Array`); }
}

export function parseSchemaBytes(value, definition, label, limits) {
  const copy = copyWireBytes(value, label);
  const strict = parseStrictJson(copy, limits);
  const toPlain = (item) => Array.isArray(item) ? item.map(toPlain)
    : item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).map(([key, child]) => [key, toPlain(child)])) : item;
  const parsed = toPlain(strict);
  assertSchema(parsed, definition, label);
  return { parsed, byteLength: copy.byteLength };
}
