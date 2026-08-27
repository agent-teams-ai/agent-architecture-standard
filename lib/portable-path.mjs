import { UNICODE_CASE_FOLD_17 } from './unicode-case-fold-17.mjs';
import { UNICODE_NORMALIZATION_17 } from './unicode-normalization-17.mjs';

const WINDOWS_RESERVED_BASENAMES = new Set([
  'con', 'prn', 'aux', 'nul', 'clock$', 'conin$', 'conout$',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`)
]);

const FORBIDDEN_CODE_POINT = /[\u0000-\u001f\u007f-\u009f\u061c\u200e-\u200f\u202a-\u202e\u2066-\u2069]/u;
const LONE_SURROGATE = /[\ud800-\udfff]/u;
const CASE_FOLD = new Map(UNICODE_CASE_FOLD_17.map(([source, mapping]) => [Number.parseInt(source, 16), mapping.split(' ').map((item) => Number.parseInt(item, 16))]));
const CCC = new Map(UNICODE_NORMALIZATION_17.combining);
const DECOMPOSITION = new Map(UNICODE_NORMALIZATION_17.decomposition);
const COMPOSITION = new Map(UNICODE_NORMALIZATION_17.composition.map(([first, second, result]) => [`${first}:${second}`, result]));
const S_BASE = 0xac00, L_BASE = 0x1100, V_BASE = 0x1161, T_BASE = 0x11a7;
const L_COUNT = 19, V_COUNT = 21, T_COUNT = 28, N_COUNT = V_COUNT * T_COUNT, S_COUNT = L_COUNT * N_COUNT;

const decomposeCodePoint = (cp, output) => {
  if (cp >= S_BASE && cp < S_BASE + S_COUNT) {
    const index = cp - S_BASE;
    output.push(L_BASE + Math.floor(index / N_COUNT), V_BASE + Math.floor((index % N_COUNT) / T_COUNT));
    if (index % T_COUNT !== 0) output.push(T_BASE + (index % T_COUNT));
    return;
  }
  const mapping = DECOMPOSITION.get(cp);
  if (mapping === undefined) output.push(cp);
  else for (const item of mapping) decomposeCodePoint(item, output);
};

/** Deterministic NFC under the digest-pinned Unicode 17.0.0 data. */
export function normalizeUnicode17Nfc(value) {
  const ordered = [];
  for (const character of value) {
    const expanded = [];
    decomposeCodePoint(character.codePointAt(0), expanded);
    for (const cp of expanded) {
      const ccc = CCC.get(cp) ?? 0;
      let position = ordered.length;
      while (ccc !== 0 && position > 0 && (CCC.get(ordered[position - 1]) ?? 0) > ccc) position -= 1;
      ordered.splice(position, 0, cp);
    }
  }
  if (ordered.length === 0) return '';
  const composed = [ordered[0]];
  let starterIndex = 0, starter = ordered[0], previousCcc = 0;
  for (let index = 1; index < ordered.length; index += 1) {
    const cp = ordered[index], ccc = CCC.get(cp) ?? 0;
    let replacement;
    if (starter >= L_BASE && starter < L_BASE + L_COUNT && cp >= V_BASE && cp < V_BASE + V_COUNT) replacement = S_BASE + ((starter - L_BASE) * V_COUNT + cp - V_BASE) * T_COUNT;
    else if (starter >= S_BASE && starter < S_BASE + S_COUNT && (starter - S_BASE) % T_COUNT === 0 && cp > T_BASE && cp < T_BASE + T_COUNT) replacement = starter + cp - T_BASE;
    else replacement = COMPOSITION.get(`${starter}:${cp}`);
    if (replacement !== undefined && (previousCcc < ccc || previousCcc === 0)) {
      composed[starterIndex] = replacement;
      starter = replacement;
    } else {
      if (ccc === 0) { starterIndex = composed.length; starter = cp; }
      composed.push(cp);
      previousCcc = ccc;
    }
  }
  return String.fromCodePoint(...composed);
}

/**
 * The pinned Unicode 17 default full case-fold collision key (C+F records,
 * F precedence, Turkic T records excluded), followed by NFC normalization.
 */
export function portablePathCollisionKey(value) {
  let folded = '';
  for (const character of normalizeUnicode17Nfc(value)) {
    const codePoint = character.codePointAt(0);
    const mapping = CASE_FOLD.get(codePoint);
    folded += mapping === undefined ? character : String.fromCodePoint(...mapping);
  }
  return normalizeUnicode17Nfc(folded);
}

/** Validate one identity-bearing portable-bounded repository path. */
export function assertPortablePath(value) {
  const fail = (message) => { throw new TypeError(`invalid portable path: ${message}`); };
  if (typeof value !== 'string' || value.length === 0) fail('nonempty string required');
  if (LONE_SURROGATE.test(value)) fail('lone UTF-16 surrogate is forbidden');
  if (value !== normalizeUnicode17Nfc(value)) fail('path must already be Unicode 17 NFC');
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
export function assertPortablePathCollection(paths, label = 'portable path collection', { allowRepeatedReferences = false } = {}) {
  if (!paths || typeof paths[Symbol.iterator] !== 'function') throw new TypeError(`${label} must be iterable`);
  const exact = new Set();
  const folded = new Map();
  for (const value of paths) {
    assertPortablePath(value);
    if (exact.has(value)) {
      if (allowRepeatedReferences) continue;
      throw new TypeError(`duplicate ${label} path: ${value}`);
    }
    exact.add(value);
    const key = portablePathCollisionKey(value);
    const previous = folded.get(key);
    if (previous !== undefined) throw new TypeError(`case-fold/NFC-colliding ${label} paths: ${previous} and ${value}`);
    folded.set(key, value);
  }
}
