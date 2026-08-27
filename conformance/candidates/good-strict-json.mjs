// Independent, single-file candidate for the private conformance adapter.
// It intentionally shares no implementation with the runner or oracle.
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';

const DIAGNOSTICS = new Set([
  'none',
  'aas.json.raw-bytes-required',
  'aas.json.input-too-large',
  'aas.json.invalid-utf8',
  'aas.json.invalid-syntax',
  'aas.json.duplicate-key',
  'aas.json.invalid-number',
  'aas.json.depth-exceeded',
]);

class ParseFault extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function utf16Compare(a, b) {
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = a.charCodeAt(index) - b.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}

function canonical(value) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort(utf16Compare).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

function parseExactInteger(token) {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(token);
  if (!match) throw new ParseFault('aas.json.invalid-syntax');
  if (match[1] === '-' && /^0(?:\.0*)?(?:[eE][+-]?\d+)?$/.test(token.slice(1))) {
    throw new ParseFault('aas.json.invalid-number');
  }
  const digits = `${match[2]}${match[3] ?? ''}`;
  const exponentText = match[4] ?? '0';
  const exponentNegative = exponentText.startsWith('-');
  const exponentDigits = exponentText.replace(/^[+-]/, '').replace(/^0+/, '') || '0';
  if (exponentDigits.length > 7) throw new ParseFault('aas.json.invalid-number');
  const exponent = Number(exponentDigits) * (exponentNegative ? -1 : 1);
  const scale = (match[3]?.length ?? 0) - exponent;
  let integerDigits = digits.replace(/^0+/, '') || '0';
  if (scale > 0) {
    if (scale > integerDigits.length) throw new ParseFault('aas.json.invalid-number');
    const fractional = integerDigits.slice(integerDigits.length - scale);
    if (!/^0*$/.test(fractional)) throw new ParseFault('aas.json.invalid-number');
    integerDigits = integerDigits.slice(0, integerDigits.length - scale) || '0';
  } else if (scale < 0) {
    if (-scale > 16) throw new ParseFault('aas.json.invalid-number');
    integerDigits += '0'.repeat(-scale);
  }
  const signed = `${match[1]}${integerDigits}`;
  let exact;
  try { exact = BigInt(signed); } catch { throw new ParseFault('aas.json.invalid-number'); }
  if (exact < -9007199254740991n || exact > 9007199254740991n) {
    throw new ParseFault('aas.json.invalid-number');
  }
  return Number(exact);
}

function parseStrict(text, maxDepth) {
  let offset = 0;
  const whitespace = () => { while (/[\x20\x09\x0a\x0d]/.test(text[offset] ?? '')) offset += 1; };
  const string = () => {
    const start = offset;
    offset += 1;
    while (offset < text.length) {
      const code = text.charCodeAt(offset);
      if (code === 0x22) {
        offset += 1;
        let value;
        try { value = JSON.parse(text.slice(start, offset)); } catch { throw new ParseFault('aas.json.invalid-syntax'); }
        for (let index = 0; index < value.length; index += 1) {
          const unit = value.charCodeAt(index);
          if (unit >= 0xd800 && unit <= 0xdbff) {
            const next = value.charCodeAt(index + 1);
            if (!(next >= 0xdc00 && next <= 0xdfff)) throw new ParseFault('aas.json.invalid-syntax');
            index += 1;
          } else if (unit >= 0xdc00 && unit <= 0xdfff) {
            throw new ParseFault('aas.json.invalid-syntax');
          }
        }
        return value;
      }
      if (code < 0x20) throw new ParseFault('aas.json.invalid-syntax');
      if (code === 0x5c) {
        offset += 1;
        if (!/["\\/bfnrtu]/.test(text[offset] ?? '')) throw new ParseFault('aas.json.invalid-syntax');
        if (text[offset] === 'u') {
          const hex = text.slice(offset + 1, offset + 5);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new ParseFault('aas.json.invalid-syntax');
          offset += 4;
        }
      }
      offset += 1;
    }
    throw new ParseFault('aas.json.invalid-syntax');
  };
  const value = (depth) => {
    whitespace();
    const character = text[offset];
    if (character === '"') return string();
    if (character === '{') {
      if (depth >= maxDepth) throw new ParseFault('aas.json.depth-exceeded');
      offset += 1;
      const object = Object.create(null);
      const keys = new Set();
      whitespace();
      if (text[offset] === '}') { offset += 1; return object; }
      while (true) {
        whitespace();
        if (text[offset] !== '"') throw new ParseFault('aas.json.invalid-syntax');
        const key = string();
        if (keys.has(key)) throw new ParseFault('aas.json.duplicate-key');
        keys.add(key);
        whitespace();
        if (text[offset] !== ':') throw new ParseFault('aas.json.invalid-syntax');
        offset += 1;
        object[key] = value(depth + 1);
        whitespace();
        if (text[offset] === '}') { offset += 1; return object; }
        if (text[offset] !== ',') throw new ParseFault('aas.json.invalid-syntax');
        offset += 1;
      }
    }
    if (character === '[') {
      if (depth >= maxDepth) throw new ParseFault('aas.json.depth-exceeded');
      offset += 1;
      const array = [];
      whitespace();
      if (text[offset] === ']') { offset += 1; return array; }
      while (true) {
        array.push(value(depth + 1));
        whitespace();
        if (text[offset] === ']') { offset += 1; return array; }
        if (text[offset] !== ',') throw new ParseFault('aas.json.invalid-syntax');
        offset += 1;
      }
    }
    for (const [literal, result] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(literal, offset)) { offset += literal.length; return result; }
    }
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(offset));
    if (match) { offset += match[0].length; return parseExactInteger(match[0]); }
    throw new ParseFault('aas.json.invalid-syntax');
  };
  const result = value(0);
  whitespace();
  if (offset !== text.length) throw new ParseFault('aas.json.invalid-syntax');
  return result;
}

function respond(request) {
  if (request.input.form !== 'bytes') {
    return { version: 'private-aas-json-v0', token: request.token, diagnostic: 'aas.json.raw-bytes-required', valueDigest: null };
  }
  const bytes = Buffer.from(request.input.base64, 'base64');
  if (bytes.length > request.limits.maxBytes) {
    return { version: 'private-aas-json-v0', token: request.token, diagnostic: 'aas.json.input-too-large', valueDigest: null };
  }
  let text;
  try {
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw new Error();
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { version: 'private-aas-json-v0', token: request.token, diagnostic: 'aas.json.invalid-utf8', valueDigest: null };
  }
  try {
    const parsed = parseStrict(text, request.limits.maxDepth);
    const valueDigest = `sha256:${createHash('sha256').update(canonical(parsed)).digest('hex')}`;
    return { version: 'private-aas-json-v0', token: request.token, diagnostic: 'none', valueDigest };
  } catch (error) {
    const diagnostic = DIAGNOSTICS.has(error?.code) ? error.code : 'aas.json.invalid-syntax';
    return { version: 'private-aas-json-v0', token: request.token, diagnostic, valueDigest: null };
  }
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  try {
    const request = JSON.parse(line);
    process.stdout.write(`${JSON.stringify(respond(request))}\n`);
  } catch {
    process.stdout.write('{"version":"private-aas-json-v0","token":"invalid","diagnostic":"aas.json.invalid-syntax","valueDigest":null}\n');
  }
}
