import { DiagnosticCode, AasDiagnosticError } from './diagnostics.mjs';

export class OfflineSchemaRegistry {
  /** @param {Iterable<string>} [allowedIds] */
  constructor(allowedIds) {
    this.schemas = new Map();
    this.allowedIds = allowedIds ? new Set(allowedIds) : null;
  }
  /** @param {Record<string, unknown>} schema */
  add(schema) {
    const id = schema.$id;
    if (typeof id !== 'string') throw new AasDiagnosticError(DiagnosticCode.SCHEMA_INVALID, 'schema has no $id');
    if (this.allowedIds && !this.allowedIds.has(id)) throw new AasDiagnosticError(DiagnosticCode.SCHEMA_ALIAS, `schema ID is not an exact catalog ID: ${id}`);
    if (this.schemas.has(id)) throw new AasDiagnosticError(DiagnosticCode.SCHEMA_DUPLICATE, `duplicate schema ID: ${id}`);
    this.schemas.set(id, schema);
  }
  /** @param {string} id */
  get(id) {
    const schema = this.schemas.get(id);
    if (!schema) throw new AasDiagnosticError(DiagnosticCode.SCHEMA_UNKNOWN, `unknown schema ID: ${id}`);
    return schema;
  }
  ids() { return [...this.schemas.keys()].sort(); }
}
