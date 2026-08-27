/** Package paths are intentionally restricted to ASCII, making NFC and full
 * default case-fold collision keys stable across Unicode/runtime versions. */
export function packageCollisionKey(relative) {
  return relative.normalize('NFC').toLowerCase();
}

export function assertPortablePackageInventory(paths, label = 'package inventory') {
  const conventionalRootFiles = new Set(['README.md', 'LICENSE']);
  const reserved = /^(?:con|prn|aux|nul|clock\$|conin\$|conout\$|com[1-9]|lpt[1-9])$/u;
  const seenExact = new Set();
  const seenCollision = new Map();
  for (const relative of paths) {
    const conventionalRoot = conventionalRootFiles.has(relative);
    if (typeof relative !== 'string' || (!conventionalRoot && !/^[a-z0-9][a-z0-9._/-]*$/u.test(relative))) {
      throw new Error(`unstable ${label} path: ${relative}`);
    }
    const segments = relative.split('/');
    if (relative !== relative.normalize('NFC') || relative.includes('\\') || relative.startsWith('/') || segments.some((part) => part === '' || part === '.' || part === '..' || part.endsWith('.') || part.endsWith(' ') || reserved.test(part.split('.')[0].toLowerCase()))) {
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
