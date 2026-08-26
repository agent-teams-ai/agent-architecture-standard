import { AasDiagnosticError, DiagnosticCode } from './diagnostics.mjs';

/** Rejects external-reference cycles; internal JSON Pointer recursion remains schema-local. */
export function assertAcyclicSchemaGraph(schemas) {
  const ids = new Map();
  for (const schema of schemas) {
    if (typeof schema.$id !== 'string') throw new AasDiagnosticError(DiagnosticCode.SCHEMA_INVALID, 'schema has no $id');
    let parsed;
    try { parsed = new URL(schema.$id); } catch { throw new AasDiagnosticError(DiagnosticCode.SCHEMA_INVALID, `invalid schema ID: ${schema.$id}`); }
    const basename = parsed.pathname.split('/').at(-1);
    if (parsed.origin !== 'https://schemas.aas.invalid' || !/^\/private\/v0\/[a-z0-9-]+\.schema\.json$/u.test(parsed.pathname) || parsed.search || parsed.hash) {
      throw new AasDiagnosticError(DiagnosticCode.SCHEMA_ALIAS, `schema ID is outside the exact private catalog namespace: ${schema.$id}`);
    }
    if (ids.has(schema.$id) || [...ids.values()].includes(basename)) throw new AasDiagnosticError(DiagnosticCode.SCHEMA_DUPLICATE, `duplicate schema ID: ${schema.$id}`);
    ids.set(schema.$id, basename);
  }
  const byName = new Map([...ids].map(([id, name]) => [name, id]));
  const graph = new Map([...ids.keys()].map((id) => [id, new Set()]));
  const scan = (value, owner) => {
    if (Array.isArray(value)) return value.forEach((item) => scan(item, owner));
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (key === '$ref' && typeof item === 'string' && !item.startsWith('#')) {
        const reference = item.split('#')[0];
        if (/^[a-z][a-z+.-]*:/i.test(reference)) throw new AasDiagnosticError(DiagnosticCode.SCHEMA_NETWORK_REF, `absolute or network $ref: ${item}`);
        if (!/^[a-z0-9-]+\.schema\.json$/u.test(reference)) throw new AasDiagnosticError(DiagnosticCode.SCHEMA_ALIAS, `aliased local $ref: ${item}`);
        const target = byName.get(reference);
        if (!target) throw new AasDiagnosticError(DiagnosticCode.SCHEMA_UNKNOWN, `unknown local $ref: ${item}`);
        graph.get(owner).add(target);
      } else scan(item, owner);
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
