/** The repository's single narrow canonical-JSON semantic primitive. */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export const sameCanonicalJson = (left, right) => canonicalJson(left) === canonicalJson(right);
export const canonicalJsonBytes = (value) => Buffer.byteLength(canonicalJson(value), 'utf8');
