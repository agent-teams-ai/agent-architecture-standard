import { assertPortablePathCollection } from './portable-path.mjs';

const present = (values) => values.filter((value) => value !== undefined);

/**
 * Enforce the portable-path rules JSON Schema cannot express: NFC, UTF-8 byte
 * ceilings, lone-surrogate rejection, and exact/default-case-fold collisions.
 * Call this only after structural schema validation has succeeded.
 */
export function assertIdentityDocumentPathInvariants(value, label = 'schema instance') {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value.entries) && value.pathProfile) {
    assertPortablePathCollection(value.entries.map((entry) => entry.path), `${label} snapshot entries`);
  }
  if (Array.isArray(value.operations) && value.baseSnapshotAasIdentity) {
    assertPortablePathCollection(value.operations.map((operation) => operation.path), `${label} overlay operations`);
  }
  if (Array.isArray(value.rules) && Array.isArray(value.exceptions) && typeof value.scope === 'string') {
    assertPortablePathCollection([value.scope, ...value.exceptions.map((exception) => exception.scope)], `${label} policy paths`);
  }
  if (value.scope && typeof value.scope === 'object' && typeof value.rolloutScope === 'string') {
    assertPortablePathCollection(present([value.scope.repositoryRoot, value.scope.path]), `${label} binding paths`);
  }
  if (value.op && value.path !== undefined) assertPortablePathCollection([value.path], `${label} overlay operation path`);
  if (Array.isArray(value.targets)) for (const target of value.targets) assertIdentityDocumentPathInvariants(target.input, `${label} target ${target.id}`);
  return value;
}
