import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sha256 } from '../lib/digests.mjs';
import { parseStrictJson } from '../lib/strict-json.mjs';
import { root, slash, walk } from './files.mjs';

const outputRoot = process.env.AAS_GENERATE_ROOT ? path.resolve(process.env.AAS_GENERATE_ROOT) : root;
const schemaPaths = (await walk('schemas')).filter((item) => item.endsWith('.schema.json'));
const schemaMap = new Map();
for (const schemaPath of schemaPaths) schemaMap.set(path.basename(schemaPath), parseStrictJson(await readFile(path.join(root, schemaPath))));

const literal = (value) => JSON.stringify(value);
const typeName = (value) => value.replace(/[^A-Za-z0-9_$]/g, '_');
function typeFor(schema, document) {
  if (schema === true) return 'JsonValue';
  if (schema === false) return 'never';
  if (schema.$ref) {
    const [file, pointer = ''] = schema.$ref.split('#');
    const segments = pointer.split('/').filter(Boolean).map((key) => key.replace(/~1/g, '/').replace(/~0/g, '~'));
    if (segments.length !== 2 || segments[0] !== '$defs' || !segments[1]) throw new Error(`unsupported generation pointer: ${schema.$ref}`);
    const targetDocument = file ? schemaMap.get(file) : document;
    if (!targetDocument?.$defs?.[segments[1]]) throw new Error(`unknown generation $ref: ${schema.$ref}`);
    const referenced = typeName(segments[1]);
    if (!file) return referenced;
    const moduleName = `./${path.basename(file, '.schema.json')}.js`;
    return `import(${JSON.stringify(moduleName)}).${referenced}`;
  }
  if ('const' in schema) return literal(schema.const);
  if (schema.enum) return schema.enum.map(literal).join(' | ');
  if (schema.oneOf || schema.anyOf) return (schema.oneOf ?? schema.anyOf).map((item) => `(${typeFor(item, document)})`).join(' | ');
  if (Array.isArray(schema.type)) return schema.type.map((item) => typeFor({ ...schema, type: item }, document)).join(' | ');
  if (schema.type === 'string') return 'ConstrainedString';
  if (schema.type === 'integer') return 'JsonInteger';
  if (schema.type === 'number') throw new Error('unbounded JSON Schema number would widen strict I-JSON declarations');
  if (schema.type === 'boolean') return 'boolean';
  if (schema.type === 'null') return 'null';
  if (schema.type === 'array') return `Array<${typeFor(schema.items ?? true, document)}>`;
  if (schema.type === 'object' || schema.properties || schema.additionalProperties) {
    const required = new Set(schema.required ?? []);
    const fields = Object.entries(schema.properties ?? {}).map(([key, value]) => `  ${JSON.stringify(key)}${required.has(key) ? '' : '?'}: ${typeFor(value, document)};`);
    if (schema.additionalProperties && schema.additionalProperties !== false) fields.push(`  [key: string]: ${schema.additionalProperties === true ? 'JsonValue' : typeFor(schema.additionalProperties, document)};`);
    return `{\n${fields.join('\n')}\n}`;
  }
  throw new Error(`unsupported schema shape in ${document.$id ?? '<anonymous>'}`);
}
await mkdir(path.join(outputRoot, 'generated'), { recursive: true });
for (const schemaPath of schemaPaths) {
  const schema = schemaMap.get(path.basename(schemaPath));
  const name = schema.title.replace(/[^A-Za-z0-9]+/g, ' ').trim().replace(/(?:^|\s)([a-z])/g, (_, c) => c.toUpperCase()).replace(/\s/g, '');
  const definitions = Object.entries(schema.$defs ?? {}).map(([definitionName, definition]) => `export type ${typeName(definitionName)} = ${typeFor(definition, schema)};`).join('\n\n');
  const preamble = `/* Generated from ${schemaPath}; JSON Schema is normative. Do not edit. */\n\nexport type ConstrainedString = string & { readonly __aasConstrainedString: unique symbol };\nexport type JsonInteger = number & { readonly __aasSafeInteger: unique symbol };\nexport type JsonValue = null | boolean | ConstrainedString | JsonInteger | JsonValue[] | { [key: string]: JsonValue };\n`;
  const declaration = `${preamble}\n${definitions}${definitions ? '\n\n' : ''}export type ${name} = ${typeFor(schema, schema)};\n`;
  const filename = path.basename(schemaPath, '.schema.json') + '.d.ts';
  await writeFile(path.join(outputRoot, 'generated', filename), declaration.replace(/\r\n?/g, '\n'), 'utf8');
}

const candidates = [
  ...schemaPaths,
  ...(await walk('schemas')).filter((item) => item.endsWith('.md')),
  ...(await walk('registries')).filter((item) => item.endsWith('.json')),
  ...(await walk('registries')).filter((item) => item.endsWith('.md')),
  ...(await walk('spec')).filter((item) => item.endsWith('.md')),
  ...(await walk('vectors')),
  'version-matrix.json',
  ...schemaPaths.map((item) => `generated/${path.basename(item, '.schema.json')}.d.ts`)
];
const unique = [...new Set(candidates)].sort();
const artifacts = [];
for (const relative of unique) {
  const sourceRoot = relative.startsWith('generated/') ? outputRoot : root;
  const bytes = await readFile(path.join(sourceRoot, relative));
  const extension = path.extname(relative);
  const entry = {
    path: slash(relative),
    class: relative.startsWith('schemas/') && relative.endsWith('.json') ? 'schema'
      : relative.startsWith('registries/') && relative.endsWith('.json') ? 'registry'
      : relative.startsWith('vectors/') && relative !== 'vectors/README.md' ? 'vector'
      : relative.startsWith('generated/') ? 'generated-declaration'
      : relative === 'version-matrix.json' ? 'version-matrix' : 'normative-prose',
    contentDigest: sha256(bytes),
    aasIdentityStatus: 'not-computed-phase-1',
    byteLength: bytes.byteLength,
    mediaType: extension === '.json' ? 'application/json' : extension === '.md' ? 'text/markdown' : 'text/typescript'
  };
  if (entry.class === 'schema') entry.schemaId = parseStrictJson(bytes).$id;
  artifacts.push(entry);
}
const manifest = {
  manifestVersion: '1',
  standardVersion: '0.1.0-rc.1',
  status: 'provisional-unpublished',
  schemaDialect: 'https://json-schema.org/draft/2020-12/schema',
  identityPolicy: {
    contentDigest: 'raw-sha256-over-exact-content-bytes',
    aasIdentity: 'domain-framed-identity-deferred-to-phase-2'
  },
  artifacts
};
await writeFile(path.join(outputRoot, 'artifacts.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
