/** Package paths are intentionally restricted to ASCII, making NFC and full
 * default case-fold collision keys stable across Unicode/runtime versions. */
export function packageCollisionKey(relative) {
  return relative.normalize('NFC').toLowerCase();
}

export function assertPortablePackageInventory(paths, label = 'package inventory') {
  const seenExact = new Set();
  const seenCollision = new Map();
  for (const relative of paths) {
    if (typeof relative !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(relative)) {
      throw new Error(`unstable ${label} path: ${relative}`);
    }
    if (relative !== relative.normalize('NFC') || relative.includes('\\') || relative.startsWith('/') || relative.split('/').some((part) => part === '' || part === '.' || part === '..')) {
      throw new Error(`non-portable ${label} path: ${relative}`);
    }
    if (seenExact.has(relative)) throw new Error(`duplicate ${label} path: ${relative}`);
    seenExact.add(relative);
    const key = packageCollisionKey(relative);
    const previous = seenCollision.get(key);
    if (previous !== undefined) throw new Error(`case-fold/NFC-colliding ${label} paths: ${previous} and ${relative}`);
    seenCollision.set(key, relative);
  }
}
