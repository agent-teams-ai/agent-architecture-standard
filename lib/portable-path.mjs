import { UNICODE_CASE_FOLD_17 } from './unicode-case-fold-17.mjs';

const WINDOWS_RESERVED_BASENAMES = new Set([
  'con', 'prn', 'aux', 'nul', 'clock$', 'conin$', 'conout$',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`)
]);

const FORBIDDEN_CODE_POINT = /[\u0000-\u001f\u007f-\u009f\u061c\u200e-\u200f\u202a-\u202e\u2066-\u2069]/u;
const LONE_SURROGATE = /[\ud800-\udfff]/u;
const CASE_FOLD = new Map(UNICODE_CASE_FOLD_17.map(([source, mapping]) => [Number.parseInt(source, 16), mapping.split(' ').map((item) => Number.parseInt(item, 16))]));

/**
 * The pinned Unicode 17 default full case-fold collision key (C+F records,
 * F precedence, Turkic T records excluded), followed by NFC normalization.
 */
export function portablePathCollisionKey(value) {
  let folded = '';
  for (const character of value.normalize('NFC')) {
    const codePoint = character.codePointAt(0);
    const mapping = CASE_FOLD.get(codePoint);
    folded += mapping === undefined ? character : String.fromCodePoint(...mapping);
  }
  return folded.normalize('NFC');
}

/** Validate one identity-bearing portable-bounded repository path. */
export function assertPortablePath(value) {
  const fail = (message) => { throw new TypeError(`invalid portable path: ${message}`); };
  if (typeof value !== 'string' || value.length === 0) fail('nonempty string required');
  if (LONE_SURROGATE.test(value)) fail('lone UTF-16 surrogate is forbidden');
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
