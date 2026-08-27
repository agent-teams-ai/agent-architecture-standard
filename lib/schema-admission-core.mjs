import { parseStrictJson } from './strict-json.mjs';

const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const getViewedArrayBuffer = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'buffer').get;
const getTypedArrayByteLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, 'byteLength').get;

export function copyWireBytes(value, label, maxBytes = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new TypeError('invalid AAS JSON limits: maxBytes must be a safe nonnegative integer');
  if (!ArrayBuffer.isView(value) || !(value instanceof Uint8Array)) throw new TypeError(`${label} must be Uint8Array backed by a non-shared ArrayBuffer`);
  let buffer, byteLength;
  try { buffer = getViewedArrayBuffer.call(value); byteLength = getTypedArrayByteLength.call(value); }
  catch { throw new TypeError(`${label} must be a cloneable non-proxy Uint8Array`); }
  if (!(buffer instanceof ArrayBuffer)) throw new TypeError(`${label} must be Uint8Array backed by a non-shared ArrayBuffer`);
  if (byteLength > maxBytes) throw new TypeError('encoded JSON exceeds maxBytes');
  try { const copy = new Uint8Array(byteLength); Uint8Array.prototype.set.call(copy, value); return copy; }
  catch { throw new TypeError(`${label} must be a cloneable non-proxy Uint8Array`); }
}

export function parseAdmittedSchemaBytes(value, definition, label, limits, assertSchema) {
  const copy = copyWireBytes(value, label, limits?.maxBytes);
  const strict = parseStrictJson(copy, limits);
  const toPlain = (item) => Array.isArray(item) ? item.map(toPlain)
    : item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).map(([key, child]) => [key, toPlain(child)])) : item;
  const parsed = toPlain(strict);
  assertSchema(parsed, definition, label);
  return { parsed, byteLength: copy.byteLength };
}
