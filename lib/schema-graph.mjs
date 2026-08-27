import { AasDiagnosticError, DiagnosticCode } from './diagnostics.mjs';

/** Deny embedded resources, anchors, non-static references, and path escapes. */
export function assertNoEmbeddedSchemaResources(schema, maxDepth = 64) {
  if (!Number.isSafeInteger(maxDepth) || maxDepth < 0) throw new TypeError('schema maxDepth must be a nonnegative safe integer');
  const pending = [{ value: schema, depth: 0, root: true }];
  while (pending.length) {
    const { value, depth, root } = pending.pop();
    if (!value || typeof value !== 'object') continue;
    if (depth > maxDepth) throw new AasDiagnosticError(DiagnosticCode.DEPTH_EXCEEDED, 'schema nesting exceeds maxDepth');
    for (const [key, item] of Object.entries(value)) {
      if (key === '$id' && !root) throw new AasDiagnosticError(DiagnosticCode.SCHEMA_ALIAS, `nested $id creates an embedded resource alias: ${item}`);
      if (key === '$anchor' || key === '$dynamicAnchor' || key === '$recursiveAnchor') throw new AasDiagnosticError(DiagnosticCode.SCHEMA_ALIAS, `${key} aliases are forbidden in the closed catalog`);
      if (key === '$dynamicRef' || key === '$recursiveRef') throw new AasDiagnosticError(DiagnosticCode.SCHEMA_NETWORK_REF, `${key} is forbidden in the static offline catalog`);
      if ((key === '$schema' && !root) || key === '$vocabulary') throw new AasDiagnosticError(DiagnosticCode.SCHEMA_NETWORK_REF, `${key} cannot alter resolution inside the closed catalog`);
      pending.push({ value: item, depth: depth + 1, root: false });
    }
  }
}

export const isCanonicalSchemaId = (id) => typeof id === 'string' && /^https:\/\/schemas\.aas\.invalid\/private\/v0\/[a-z0-9-]+\.schema\.json$/u.test(id);

/** Rejects external-reference cycles; internal JSON Pointer recursion remains schema-local. */
export function assertAcyclicSchemaGraph(schemas, limits = { maxSchemas: 4096, maxDepth: 64 }) {
  if (!Number.isSafeInteger(limits.maxSchemas) || limits.maxSchemas < 0 || !Number.isSafeInteger(limits.maxDepth) || limits.maxDepth < 0) throw new TypeError('schema catalog limits must be nonnegative safe integers');
  if (schemas.length > limits.maxSchemas) throw new AasDiagnosticError(DiagnosticCode.INPUT_TOO_LARGE, 'schema catalog exceeds maxSchemas');
  const ids = new Map();
  for (const schema of schemas) {
    assertNoEmbeddedSchemaResources(schema, limits.maxDepth);
    if (typeof schema.$id !== 'string') throw new AasDiagnosticError(DiagnosticCode.SCHEMA_INVALID, 'schema has no $id');
    if (!isCanonicalSchemaId(schema.$id)) {
      throw new AasDiagnosticError(DiagnosticCode.SCHEMA_ALIAS, `schema ID is outside the exact private catalog namespace: ${schema.$id}`);
    }
    const basename = schema.$id.slice(schema.$id.lastIndexOf('/') + 1);
    if (ids.has(schema.$id) || [...ids.values()].includes(basename)) throw new AasDiagnosticError(DiagnosticCode.SCHEMA_DUPLICATE, `duplicate schema ID: ${schema.$id}`);
    ids.set(schema.$id, basename);
  }
  const byName = new Map([...ids].map(([id, name]) => [name, id]));
  const graph = new Map([...ids.keys()].map((id) => [id, new Set()]));
  const scan = (root, owner) => {
    const pending = [root];
    while (pending.length) {
      const value = pending.pop();
      if (!value || typeof value !== 'object') continue;
    for (const [key, item] of Object.entries(value)) {
      if (key === '$ref' && typeof item === 'string' && !item.startsWith('#')) {
        const reference = item.split('#')[0];
        if (/^[a-z][a-z+.-]*:/i.test(reference) || reference.startsWith('//') || reference.startsWith('/') || reference.includes('\\')) throw new AasDiagnosticError(DiagnosticCode.SCHEMA_NETWORK_REF, `absolute, network, or filesystem $ref: ${item}`);
        if (!/^[a-z0-9-]+\.schema\.json$/u.test(reference)) throw new AasDiagnosticError(DiagnosticCode.SCHEMA_ALIAS, `aliased local $ref: ${item}`);
        const target = byName.get(reference);
        if (!target) throw new AasDiagnosticError(DiagnosticCode.SCHEMA_UNKNOWN, `unknown local $ref: ${item}`);
        graph.get(owner).add(target);
      } else pending.push(item);
    }
    }
  };
  for (const schema of schemas) scan(schema, schema.$id);
  const visiting = new Set(), visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) throw new AasDiagnosticError(DiagnosticCode.SCHEMA_REF_CYCLE, `external schema cycle: ${id}`);
    if (visited.has(id)) return;
    visiting.add(id); for (const target of graph.get(id)) visit(target); visiting.delete(id); visited.add(id);
  };
  for (const id of graph.keys()) visit(id);
}
