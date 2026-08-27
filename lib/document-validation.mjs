import { assertPortablePath, assertPortablePathCollection } from './portable-path.mjs';

const sameProfile = (left, right) => left?.version === right?.version && left?.id === right?.id && left?.aasIdentity === right?.aasIdentity;

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
    assertPortablePathCollection([value.scope, ...value.exceptions.map((exception) => exception.scope)], `${label} policy paths`, { allowRepeatedReferences: true });
    for (const exception of value.exceptions) if (!sameProfile(exception.pathProfile, value.pathProfile)) throw new TypeError(`${label} exception path profile differs from effective policy`);
  }
  if (value.scope && typeof value.scope === 'object' && typeof value.rolloutScope === 'string') {
    assertPortablePathCollection([value.scope.repositoryRoot, value.scope.path].filter((item) => item !== undefined), `${label} binding paths`, { allowRepeatedReferences: true });
  }
  if (typeof value.ruleId === 'string' && typeof value.scope === 'string' && value.validForRevision) assertPortablePath(value.scope);
  if (value.op && value.path !== undefined) assertPortablePath(value.path);
  if (Array.isArray(value.targets)) for (const target of value.targets) assertIdentityDocumentPathInvariants(target.input, `${label} target ${target.id}`);
  return value;
}
