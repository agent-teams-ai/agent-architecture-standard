import { assertPortablePath, assertPortablePathCollection, portablePathCollisionKey } from '../lib/portable-path.mjs';

/** Package paths are restricted to ASCII, but use the normative shared key. */
export const packageCollisionKey = portablePathCollisionKey;

export function assertPortablePackageInventory(paths, label = 'package inventory') {
  const conventionalRootFiles = new Set(['README.md', 'LICENSE', 'CONTRIBUTING.md', 'GOVERNANCE.md', 'MAINTAINERS.md', 'SECURITY.md', 'SOURCE.md', 'decisions/README.md', 'docs/decisions/README.md']);
  for (const relative of paths) {
    const conventionalRoot = conventionalRootFiles.has(relative);
    if (typeof relative !== 'string' || (!conventionalRoot && !/^[a-z0-9][a-z0-9._/-]*$/u.test(relative))) {
      throw new Error(`unstable ${label} path: ${relative}`);
    }
    try { assertPortablePath(relative); } catch (error) {
      const category = /exceed/u.test(error.message) ? 'bounded' : 'non-portable';
      throw new Error(`${category} ${label} path${category === 'bounded' ? ' exceeded' : ''}: ${relative}`, { cause: error });
    }
  }
  try { assertPortablePathCollection(paths, label); } catch (error) {
    if (/duplicate|colliding/u.test(error.message)) {throw new Error(error.message, { cause: error });}
    throw error;
  }
}
