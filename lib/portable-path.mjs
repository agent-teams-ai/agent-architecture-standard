const WINDOWS_RESERVED_BASENAMES = new Set([
  'con', 'prn', 'aux', 'nul', 'clock$', 'conin$', 'conout$',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`)
]);

const FORBIDDEN_CODE_POINT = /[\u0000-\u001f\u007f-\u009f\u061c\u200e-\u200f\u202a-\u202e\u2066-\u2069]/u;

/**
 * A locale-independent Unicode case-fold collision key.  The upper/lower
 * round-trip expands the multi-code-point folds exposed by the ECMAScript
 * Unicode tables (for example sharp-s and presentation-form ligatures).
 * Explicit context-sensitive folds close the remaining common differences.
 */
export function portablePathCollisionKey(value) {
  return value.normalize('NFC').toUpperCase().toLowerCase()
    .replace(/ß/gu, 'ss')
    .replace(/ς/gu, 'σ')
    .replace(/ſ/gu, 's')
    .normalize('NFC');
}

/** Validate one identity-bearing portable-bounded repository path. */
export function assertPortablePath(value) {
  const fail = (message) => { throw new TypeError(`invalid portable path: ${message}`); };
  if (typeof value !== 'string' || value.length === 0) fail('nonempty string required');
  if (value !== value.normalize('NFC')) fail('path must already be Unicode NFC');
  if (FORBIDDEN_CODE_POINT.test(value)) fail('control or bidi-control code point is forbidden');
  if (value.startsWith('/') || value.startsWith('\\') || /^[A-Za-z]:/u.test(value) || value.includes('\\')) fail('absolute, drive, UNC, device, and backslash paths are forbidden');
  if (Buffer.byteLength(value, 'utf8') > 4096) fail('path exceeds 4096 UTF-8 bytes');
  const segments = value.split('/');
  if (segments.length > 64) fail('path exceeds 64 segments');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..') fail('empty and dot segments are forbidden');
    if (Buffer.byteLength(segment, 'utf8') > 255) fail('segment exceeds 255 UTF-8 bytes');
    if (segment.endsWith('.') || segment.endsWith(' ')) fail('segment may not end in dot or space');
    if (WINDOWS_RESERVED_BASENAMES.has(segment.split('.', 1)[0].toLowerCase())) fail('Windows reserved-device basename is forbidden');
  }
  return value;
}

/** Backward-compatible name retained for existing callers. */
export const assertBoundedPortablePath = assertPortablePath;

/** Validate paths and reject exact or Unicode case-fold/NFC aliases. */
export function assertPortablePathCollection(paths, label = 'portable path collection') {
  if (!paths || typeof paths[Symbol.iterator] !== 'function') throw new TypeError(`${label} must be iterable`);
  const exact = new Set();
  const folded = new Map();
  for (const value of paths) {
    assertPortablePath(value);
    if (exact.has(value)) throw new TypeError(`duplicate ${label} path: ${value}`);
    exact.add(value);
    const key = portablePathCollisionKey(value);
    const previous = folded.get(key);
    if (previous !== undefined) throw new TypeError(`case-fold/NFC-colliding ${label} paths: ${previous} and ${value}`);
    folded.set(key, value);
  }
}
