/** Bounded, stable ingestion and registry diagnostics. */
export const DiagnosticCode = Object.freeze({
  RAW_BYTES_REQUIRED: 'aas.json.raw-bytes-required',
  INPUT_TOO_LARGE: 'aas.json.input-too-large',
  DEPTH_EXCEEDED: 'aas.json.depth-exceeded',
  DUPLICATE_KEY: 'aas.json.duplicate-key',
  INVALID_UTF8: 'aas.json.invalid-utf8',
  INVALID_SYNTAX: 'aas.json.invalid-syntax',
  INVALID_NUMBER: 'aas.json.invalid-number',
  SCHEMA_UNKNOWN: 'aas.schema.unknown-id',
  SCHEMA_DUPLICATE: 'aas.schema.duplicate-id',
  SCHEMA_ALIAS: 'aas.schema.alias-id',
  SCHEMA_NETWORK_REF: 'aas.schema.network-ref',
  SCHEMA_REF_CYCLE: 'aas.schema.ref-cycle',
  SCHEMA_INVALID: 'aas.schema.invalid'
});

export class AasDiagnosticError extends Error {
  /** @param {string} code @param {string} message @param {number} [offset] */
  constructor(code, message, offset = 0) {
    super(message);
    this.name = 'AasDiagnosticError';
    this.code = code;
    this.offset = offset;
  }
}
