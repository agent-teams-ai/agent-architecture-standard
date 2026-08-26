import { TextDecoder } from 'node:util';
import { AasDiagnosticError, DiagnosticCode } from './diagnostics.mjs';

export const DEFAULT_JSON_LIMITS = Object.freeze({ maxBytes: 1_048_576, maxDepth: 64 });
const forbiddenKeys = new Set(['__proto__', 'constructor', 'prototype']);

/** Strict dependency-free raw-byte I-JSON ingestion with null-prototype objects. */
export function parseStrictJson(input, limits = DEFAULT_JSON_LIMITS) {
  if (!(input instanceof Uint8Array)) {
    throw new AasDiagnosticError(DiagnosticCode.RAW_BYTES_REQUIRED, 'strict JSON input must be raw bytes');
  }
  if (!Number.isSafeInteger(limits.maxBytes) || limits.maxBytes < 0 || !Number.isSafeInteger(limits.maxDepth) || limits.maxDepth < 0) {
    throw new TypeError('strict JSON limits must be nonnegative safe integers');
  }
  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (bytes.byteLength > limits.maxBytes) throw new AasDiagnosticError(DiagnosticCode.INPUT_TOO_LARGE, 'encoded JSON exceeds maxBytes');
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes); }
  catch { throw new AasDiagnosticError(DiagnosticCode.INVALID_UTF8, 'input is not valid UTF-8'); }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new AasDiagnosticError(DiagnosticCode.INVALID_UTF8, 'UTF-8 BOM is forbidden');
  }
  let at = 0;
  const fail = (code, message) => { throw new AasDiagnosticError(code, message, at); };
  const ws = () => { while (at < text.length && /[\x20\x09\x0a\x0d]/u.test(text[at])) at++; };
  const string = () => {
    const start = at++;
    while (at < text.length) {
      const c = text.charCodeAt(at++);
      if (c === 0x22) {
        const raw = text.slice(start, at);
        try {
          const value = JSON.parse(raw);
          for (let i = 0; i < value.length; i++) {
            const unit = value.charCodeAt(i);
            if (unit >= 0xd800 && unit <= 0xdbff) {
              if (++i >= value.length || value.charCodeAt(i) < 0xdc00 || value.charCodeAt(i) > 0xdfff) fail(DiagnosticCode.INVALID_SYNTAX, 'lone surrogate is forbidden');
            } else if (unit >= 0xdc00 && unit <= 0xdfff) fail(DiagnosticCode.INVALID_SYNTAX, 'lone surrogate is forbidden');
          }
          return value;
        } catch (error) {
          if (error instanceof AasDiagnosticError) throw error;
          fail(DiagnosticCode.INVALID_SYNTAX, 'invalid JSON string');
        }
      }
      if (c < 0x20) fail(DiagnosticCode.INVALID_SYNTAX, 'unescaped control in string');
      if (c === 0x5c) at++;
    }
    fail(DiagnosticCode.INVALID_SYNTAX, 'unterminated string');
  };
  const value = (depth) => {
    ws();
    const c = text[at];
    if (c === '"') return string();
    if (c === '{') {
      if (depth >= limits.maxDepth) fail(DiagnosticCode.DEPTH_EXCEEDED, 'JSON nesting exceeds maxDepth');
      at++; const out = Object.create(null); const keys = new Set(); ws();
      if (text[at] === '}') { at++; return out; }
      while (true) {
        if (text[at] !== '"') fail(DiagnosticCode.INVALID_SYNTAX, 'object key must be a string');
        const key = string();
        if (forbiddenKeys.has(key)) fail(DiagnosticCode.UNSAFE_KEY, 'prototype-sensitive object key is forbidden');
        if (keys.has(key)) fail(DiagnosticCode.DUPLICATE_KEY, 'duplicate decoded object key');
        keys.add(key); ws(); if (text[at++] !== ':') fail(DiagnosticCode.INVALID_SYNTAX, 'expected colon');
        out[key] = value(depth + 1); ws();
        if (text[at] === '}') { at++; return out; }
        if (text[at++] !== ',') fail(DiagnosticCode.INVALID_SYNTAX, 'expected comma'); ws();
      }
    }
    if (c === '[') {
      if (depth >= limits.maxDepth) fail(DiagnosticCode.DEPTH_EXCEEDED, 'JSON nesting exceeds maxDepth');
      at++; const out = []; ws(); if (text[at] === ']') { at++; return out; }
      while (true) { out.push(value(depth + 1)); ws(); if (text[at] === ']') { at++; return out; } if (text[at++] !== ',') fail(DiagnosticCode.INVALID_SYNTAX, 'expected comma'); }
    }
    for (const [token, parsed] of [['true', true], ['false', false], ['null', null]]) {
      if (text.startsWith(token, at)) { at += token.length; return parsed; }
    }
    const match = /^(-?(?:0|[1-9][0-9]*))(?![.eE0-9])/u.exec(text.slice(at));
    if (match) {
      at += match[1].length;
      const number = Number(match[1]);
      if (!Number.isSafeInteger(number) || Object.is(number, -0)) fail(DiagnosticCode.INVALID_NUMBER, 'number is outside strict I-JSON integer profile');
      return number;
    }
    fail(/[.eE]/u.test(text.slice(at, at + 24)) ? DiagnosticCode.INVALID_NUMBER : DiagnosticCode.INVALID_SYNTAX, 'invalid JSON value');
  };
  const result = value(0); ws();
  if (at !== text.length) fail(DiagnosticCode.INVALID_SYNTAX, 'trailing input');
  return result;
}
