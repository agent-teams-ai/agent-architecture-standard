import { assertPortablePath, assertPortablePathCollection } from './portable-path.mjs';

const eachPath = (values) => { for (const value of values) if (value !== undefined) assertPortablePath(value); };

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
    assertPortablePathCollection(value.operations.map((operation) => operation.path), `${label} overlay operation identities`, { allowRepeatedReferences: true });
  }
  if (Array.isArray(value.rules) && Array.isArray(value.exceptions) && typeof value.scope === 'string') {
    eachPath([value.scope, ...value.exceptions.map((exception) => exception.scope)]);
  }
  if (value.scope && typeof value.scope === 'object' && typeof value.rolloutScope === 'string') {
    eachPath([value.scope.repositoryRoot, value.scope.path]);
  }
  if (value.op && value.path !== undefined) assertPortablePath(value.path);
  if (Array.isArray(value.targets)) for (const target of value.targets) assertIdentityDocumentPathInvariants(target.input, `${label} target ${target.id}`);
  return value;
}
