/** Enforce the portable path profile's encoded-byte and segment ceilings. */
export function assertBoundedPortablePath(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 4096) throw new TypeError('portable path exceeds 4096 encoded bytes');
  const segments = value.split('/');
  if (segments.length > 64) throw new TypeError('portable path exceeds 64 segments');
  if (segments.some((segment) => Buffer.byteLength(segment, 'utf8') > 255)) throw new TypeError('portable path segment exceeds 255 encoded bytes');
}
