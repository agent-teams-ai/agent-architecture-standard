#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadOracleCases } from './oracle.mjs';
import { admitCandidate } from './candidate-admission.mjs';
import { CANDIDATE_LOADER_SOURCE, createCandidateFrame } from './candidate-frame.mjs';

const PROTOCOL = 'private-aas-json-v0';
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const TOKEN = /^[0-9a-f]{32}$/;
const DIAGNOSTICS = new Set([
  'none', 'aas.json.raw-bytes-required', 'aas.json.input-too-large',
  'aas.json.invalid-utf8', 'aas.json.invalid-syntax', 'aas.json.duplicate-key',
  'aas.json.invalid-number', 'aas.json.depth-exceeded',
]);
const FAILURE_CODES = new Set([
  'none', 'oracle-mismatch', 'malformed-response', 'unexpected-response-field',
  'response-too-large', 'timeout', 'settlement-timeout', 'launch-failed',
]);
const CLEANUP = new Set(['bounded-attempt-complete', 'bounded-attempt-deadline', 'launch-failed']);

export const DEFAULT_BOUNDS = Object.freeze({
  candidateBytes: 262144,
  candidateNameBytes: 64,
  requestBytes: 1500000,
  responseBytes: 4096,
  stderrBytes: 4096,
  invocationMilliseconds: 2000,
  settlementMilliseconds: 1000,
});

export { CANDIDATE_LOADER_SOURCE };
export const CANDIDATE_NODE_ARGS = Object.freeze([
  '--permission',
  '--no-addons',
  '--disable-proto=delete',
  '--input-type=module',
  '--eval',
  CANDIDATE_LOADER_SOURCE,
]);

const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const ownKeysAre = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).toSorted().join('\0') === [...keys].toSorted().join('\0');
const remaining = (deadline) => Math.max(0, Math.ceil(deadline - performance.now()));

function validateBounds(value) {
  if (!ownKeysAre(value, Object.keys(DEFAULT_BOUNDS))) {throw new Error('invalid-bounds');}
  for (const [key, defaultValue] of Object.entries(DEFAULT_BOUNDS)) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 1 || value[key] > defaultValue * 10) {throw new Error('invalid-bounds');}
  }
  return Object.freeze({ ...value });
}

function boundedCandidateName(name, bounds) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)
      || Buffer.byteLength(name) > bounds.candidateNameBytes) {throw new Error('invalid-candidate-name');}
  return name;
}

function candidateEnvironment() {
  return Object.freeze({ LANG: 'C', LC_ALL: 'C', TZ: 'UTC' });
}

function waitUntil(promise, deadline, fallback) {
  const milliseconds = remaining(deadline);
  if (milliseconds === 0) {return Promise.resolve(fallback);}
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) {return;}
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(fallback), milliseconds);
    Promise.resolve(promise).then(finish, () => finish(fallback));
  });
}

async function teardown(child, deadline, closeState) {
  if (!child?.pid) {return 'launch-failed';}
  if (process.platform === 'win32') {
    try { child.kill('SIGKILL'); } catch { /* bounded best effort */ }
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); } catch (error) {
      if (error?.code !== 'ESRCH') {
        try { child.kill('SIGKILL'); } catch { /* bounded best effort */ }
      }
    }
  }
  const closed = closeState
    ? (closeState.isClosed() ? Promise.resolve(true) : closeState.promise)
    : (child.exitCode !== null || child.signalCode !== null
      ? Promise.resolve(true)
      : new Promise((resolve) => { child.once('close', () => { resolve(true); }); }));
  const reaped = await waitUntil(closed, deadline, false);
  child.stdin?.destroy();
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.stdio?.[3]?.destroy();
  child.stdio?.[4]?.destroy();
  return reaped ? 'bounded-attempt-complete' : 'bounded-attempt-deadline';
}

export const testOnlyTeardown = teardown;

function parseTinyRecord(text) {
  let offset = 0;
  const whitespace = () => {
    while (text[offset] === ' ' || text[offset] === '\t' || text[offset] === '\r' || text[offset] === '\n') {offset += 1;}
  };
  const string = (escapes = true) => {
    whitespace();
    if (text[offset] !== '"') {throw new Error('string');}
    const start = offset;
    offset += 1;
    while (offset < text.length) {
      const code = text.charCodeAt(offset);
      if (code === 0x22) {
        offset += 1;
        return JSON.parse(text.slice(start, offset));
      }
      if (code < 0x20) {throw new Error('control');}
      if (code === 0x5c) {
        if (!escapes) {throw new Error('escaped-key');}
        offset += 1;
        if (text[offset] === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(offset + 1, offset + 5))) {throw new Error('escape');}
          offset += 5;
          continue;
        }
        if (!/["\\/bfnrt]/.test(text[offset] ?? '')) {throw new Error('escape');}
      }
      offset += 1;
    }
    throw new Error('unterminated');
  };
  whitespace();
  if (text[offset] !== '{') {throw new Error('object');}
  offset += 1;
  const value = Object.create(null);
  const seen = new Set();
  whitespace();
  if (text[offset] === '}') {offset += 1;}
  else {
    for (;;) {
      const key = string(false);
      if (seen.has(key)) {throw new Error('duplicate');}
      seen.add(key);
      whitespace();
      if (text[offset] !== ':') {throw new Error('colon');}
      offset += 1;
      whitespace();
      if (text.startsWith('null', offset)) {
        value[key] = null;
        offset += 4;
      } else {value[key] = string();}
      whitespace();
      if (text[offset] === '}') { offset += 1; break; }
      if (text[offset] !== ',') {throw new Error('comma');}
      offset += 1;
    }
  }
  whitespace();
  if (offset !== text.length) {throw new Error('trailing');}
  return value;
}

export function validateResponse(line, expectedToken, bounds = DEFAULT_BOUNDS) {
  if (Buffer.byteLength(line) > bounds.responseBytes) {return { failure: 'response-too-large' };}
  let value;
  try { value = parseTinyRecord(line); } catch { return { failure: 'malformed-response' }; }
  const keys = ['version', 'token', 'diagnostic', 'valueDigest'];
  if (!ownKeysAre(value, keys)) {return { failure: 'unexpected-response-field' };}
  if (value.version !== PROTOCOL || value.token !== expectedToken || !TOKEN.test(value.token)
      || typeof value.diagnostic !== 'string' || value.diagnostic.length > 64 || !DIAGNOSTICS.has(value.diagnostic)
      || !(value.valueDigest === null || (typeof value.valueDigest === 'string' && DIGEST.test(value.valueDigest)))
      || (value.diagnostic === 'none') !== (value.valueDigest !== null)) {
    return { failure: 'malformed-response' };
  }
  return { failure: 'none', diagnostic: value.diagnostic, valueDigest: value.valueDigest };
}

function writePipe(stream, bytes) {
  return new Promise((resolve) => {
    if (!stream) { resolve(false); return; }
    let settled = false;
    const onError = () => finish(false);
    const finish = (ok) => {
      if (settled) {return;}
      settled = true;
      resolve(ok);
    };
    stream.once('error', onError);
    stream.end(bytes, (error) => finish(error === undefined || error === null));
  });
}

let permissionContractCheck;
export function verifyNodePermissionContract() {
  permissionContractCheck ??= (async () => {
    if (process.versions.node.split('.')[0] !== '24') {return false;}
    const probe = Buffer.from("const scopes=['fs.read','fs.write','child','worker','addons'];if(!scopes.every((scope)=>process.permission?.has(scope)===false))process.exitCode=91");
    const started = performance.now();
    const invocationDeadline = started + DEFAULT_BOUNDS.invocationMilliseconds;
    const absoluteDeadline = invocationDeadline + DEFAULT_BOUNDS.settlementMilliseconds;
    let child;
    try {
      child = spawn(process.execPath, CANDIDATE_NODE_ARGS, {
        detached: process.platform !== 'win32',
        env: candidateEnvironment(),
        shell: false,
        stdio: ['ignore', 'ignore', 'ignore', 'pipe'],
        windowsHide: true,
      });
    } catch { return false; }
    let closed = false;
    let notifyClose;
    const closePromise = new Promise((resolve) => { notifyClose = resolve; });
    const settled = new Promise((resolve) => {
      child.once('error', () => resolve(false));
      child.once('close', (code) => {
        closed = true;
        notifyClose(true);
        resolve(code === 0);
      });
    });
    const frameWrite = writePipe(child.stdio[3], createCandidateFrame(probe));
    const [supported, delivered] = await waitUntil(
      Promise.all([settled, frameWrite]), invocationDeadline, [false, false],
    );
    await teardown(child, absoluteDeadline, { promise: closePromise, isClosed: () => closed });
    return supported && delivered;
  })();
  return permissionContractCheck;
}

async function executeOne(candidateBytes, request, bounds) {
  const encoded = Buffer.from(`${JSON.stringify(request)}\n`);
  if (encoded.length > bounds.requestBytes) {throw new Error('request-too-large');}
  const started = performance.now();
  const invocationDeadline = started + bounds.invocationMilliseconds;
  const absoluteDeadline = invocationDeadline + bounds.settlementMilliseconds;
  let child;
  try {
    child = spawn(process.execPath, CANDIDATE_NODE_ARGS, {
      detached: process.platform !== 'win32',
      env: candidateEnvironment(),
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch {
    return { failure: 'launch-failed', diagnostic: null, cleanup: 'launch-failed' };
  }

  let stdout = Buffer.alloc(0);
  let stderrBytes = 0;
  let streamFailure = false;
  let closed = false;
  let notifyEvent;
  const event = new Promise((resolve) => { notifyEvent = resolve; });
  let notifyClose;
  const closePromise = new Promise((resolve) => { notifyClose = resolve; });
  child.once('error', () => { streamFailure = true; notifyEvent('error'); });
  child.once('exit', () => notifyEvent('exit'));
  child.once('close', () => { closed = true; notifyClose(true); notifyEvent('close'); });
  child.stdout.on('error', () => { streamFailure = true; notifyEvent('pipe-error'); });
  child.stderr.on('error', () => { streamFailure = true; notifyEvent('pipe-error'); });
  child.stdout.on('data', (chunk) => {
    const available = Math.max(0, bounds.responseBytes + 1 - stdout.length);
    if (available > 0) {stdout = Buffer.concat([stdout, chunk.subarray(0, available)]);}
    if (stdout.includes(0x0a)) {notifyEvent('response');}
    if (stdout.length > bounds.responseBytes) {notifyEvent('oversized');}
  });
  child.stderr.on('data', (chunk) => {
    stderrBytes = Math.min(bounds.stderrBytes + 1, stderrBytes + chunk.length);
    notifyEvent('stderr');
  });

  const candidateWrite = writePipe(child.stdio[3], createCandidateFrame(candidateBytes));
  const requestWrite = writePipe(child.stdin, encoded);
  const first = await waitUntil(event, invocationDeadline, 'timeout');
  const responseDeadline = Math.min(absoluteDeadline, performance.now() + bounds.settlementMilliseconds);
  const responseSettlement = first === 'response'
    ? await waitUntil(closePromise, responseDeadline, false)
    : true;
  const cleanup = await teardown(child, absoluteDeadline, { promise: closePromise, isClosed: () => closed });
  const writes = await waitUntil(Promise.all([candidateWrite, requestWrite]), absoluteDeadline, [false, false]);

  if (!responseSettlement || cleanup === 'bounded-attempt-deadline') {return { failure: 'settlement-timeout', diagnostic: null, cleanup };}
  if (first === 'error' || !child.pid) {return { failure: 'launch-failed', diagnostic: null, cleanup };}
  if (first === 'timeout') {return { failure: 'timeout', diagnostic: null, cleanup };}
  if (stdout.length > bounds.responseBytes || first === 'oversized' || stderrBytes > bounds.stderrBytes) {
    return { failure: 'response-too-large', diagnostic: null, cleanup };
  }
  if (stderrBytes !== 0 || streamFailure || writes.some((ok) => !ok)) {
    return { failure: 'malformed-response', diagnostic: null, cleanup };
  }
  const text = stdout.toString('utf8');
  if (!text.endsWith('\n') || text.slice(0, -1).includes('\n')) {
    return { failure: 'malformed-response', diagnostic: null, cleanup };
  }
  return { ...validateResponse(text.slice(0, -1), request.token, bounds), cleanup };
}

function requestFor(item, token) {
  const request = {
    version: PROTOCOL,
    token,
    input: item.form === 'bytes'
      ? { form: 'bytes', base64: item.bytes.toString('base64') }
      : { form: 'decoded-text', text: item.bytes.toString('utf8') },
    limits: { maxBytes: item.limits.maxBytes, maxDepth: item.limits.maxDepth },
  };
  if (!ownKeysAre(request, ['version', 'token', 'input', 'limits'])
      || !ownKeysAre(request.limits, ['maxBytes', 'maxDepth'])
      || !(ownKeysAre(request.input, ['form', 'base64']) || ownKeysAre(request.input, ['form', 'text']))) {
    throw new Error('internal-request-schema');
  }
  return request;
}

function validateReport(report) {
  if (!ownKeysAre(report, ['schemaVersion', 'qualification', 'candidate', 'bindings', 'bounds', 'boundary', 'summary', 'invocations'])
      || !ownKeysAre(report.candidate, ['name', 'digest', 'artifact'])
      || !ownKeysAre(report.bindings, ['suiteDigest', 'corpusDigest', 'oracleObservedSourceDigest', 'runnerObservedSourceDigest', 'candidateDigest', 'inputDigest', 'toolchainId', 'boundsId', 'replayId'])
      || !ownKeysAre(report.boundary, ['adapter', 'internalPrototypeSemantics', 'nodePermissionControls', 'networkIsolation', 'osProcessContainment', 'runtimeExecutionAttestation', 'multiFileClosureAttestation', 'sourceBindings'])
      || !ownKeysAre(report.summary, ['total', 'passed', 'failed', 'result'])
      || !ownKeysAre(report.bounds, Object.keys(DEFAULT_BOUNDS))
      || report.schemaVersion !== 'private-aas-conformance-report-v0'
      || report.qualification !== 'none-private-nonnormative'
      || Object.values(report.bindings).some((value) => typeof value !== 'string' || !DIGEST.test(value))
      || Object.values(report.boundary).some((value) => typeof value !== 'string' || Buffer.byteLength(value) > 96)
      || report.summary.total !== 18 || report.summary.passed + report.summary.failed !== 18
      || !['pass', 'fail'].includes(report.summary.result) || report.invocations.length !== 18) {
    throw new Error('internal-report-schema');
  }
  for (const item of report.invocations) {
    if (!ownKeysAre(item, ['status', 'failure', 'observedDiagnostic', 'cleanup'])
        || !['pass', 'fail'].includes(item.status)
        || !FAILURE_CODES.has(item.failure) || !(item.observedDiagnostic === null || DIAGNOSTICS.has(item.observedDiagnostic))
        || !CLEANUP.has(item.cleanup)) {throw new Error('internal-report-schema');}
  }
  return report;
}

export function createTransportPlan(length) {
  if (!Number.isSafeInteger(length) || length < 1 || length > 1024) {throw new Error('invalid-transport-length');}
  const indexes = Array.from({ length }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const other = randomInt(index + 1);
    [indexes[index], indexes[other]] = [indexes[other], indexes[index]];
  }
  return Object.freeze(indexes.map((caseIndex) => Object.freeze({
    caseIndex,
    token: randomBytes(16).toString('hex'),
  })));
}

export async function runSuite({ candidatePath, candidateName, bounds: suppliedBounds = DEFAULT_BOUNDS }) {
  const bounds = validateBounds(suppliedBounds);
  const name = boundedCandidateName(candidateName, bounds);
  if (!(await verifyNodePermissionContract())) {throw new Error('unsupported-node-permission-contract');}
  const candidateBytes = await admitCandidate(candidatePath, bounds.candidateBytes);
  const candidateDigest = sha256(candidateBytes);
  const oracle = await loadOracleCases();
  const oracleObservedBytes = await readFile(new URL('./oracle.mjs', import.meta.url));
  const runnerObservedBytes = await readFile(fileURLToPath(import.meta.url));
  const suiteDescriptor = Buffer.from(`${PROTOCOL}\nstrict-json-corpus-18\nprivate-nonnormative\n`);
  const suiteDigest = sha256(suiteDescriptor);
  const oracleObservedSourceDigest = sha256(oracleObservedBytes);
  const runnerObservedSourceDigest = sha256(runnerObservedBytes);
  const inputDigest = sha256(Buffer.concat(oracle.cases.flatMap((item) => [
    Buffer.from(`${item.form}\0${item.limits.maxBytes}\0${item.limits.maxDepth}\0${item.bytes.length}\0`), item.bytes,
  ])));
  const toolchainId = sha256(Buffer.from(`node:${process.version}\0${process.platform}\0${process.arch}`));
  const boundsId = sha256(Buffer.from(JSON.stringify(bounds)));
  const replayId = sha256(Buffer.from([suiteDigest, oracle.corpusDigest, oracleObservedSourceDigest, runnerObservedSourceDigest, candidateDigest, inputDigest, toolchainId, boundsId].join('\n')));
  const invocations = Array(oracle.cases.length);
  for (const transport of createTransportPlan(oracle.cases.length)) {
    const { caseIndex: index, token } = transport;
    const item = oracle.cases[index];
    const observed = await executeOne(candidateBytes, requestFor(item, token), bounds);
    const matched = observed.failure === 'none' && observed.diagnostic === item.diagnostic && observed.valueDigest === item.valueDigest;
    invocations[index] = {
      status: matched ? 'pass' : 'fail',
      failure: matched ? 'none' : (observed.failure === 'none' ? 'oracle-mismatch' : observed.failure),
      observedDiagnostic: observed.diagnostic ?? null,
      cleanup: observed.cleanup,
    };
  }
  const passed = invocations.filter((item) => item.status === 'pass').length;
  return validateReport({
    schemaVersion: 'private-aas-conformance-report-v0',
    qualification: 'none-private-nonnormative',
    candidate: { name, digest: candidateDigest, artifact: 'admitted-handle-bytes-data-url-node-esm' },
    bindings: { suiteDigest, corpusDigest: oracle.corpusDigest, oracleObservedSourceDigest, runnerObservedSourceDigest, candidateDigest, inputDigest, toolchainId, boundsId, replayId },
    bounds,
    boundary: {
      adapter: 'private-nonnormative-no-public-v0-transport',
      internalPrototypeSemantics: 'omitted-unobservable',
      nodePermissionControls: 'fs-child-worker-addon-denied',
      networkIsolation: 'not-controlled-by-node24-permissions',
      osProcessContainment: 'windows-tree-containment-absent-posix-group-or-bounded-root-termination-closure-attempt-only',
      runtimeExecutionAttestation: 'not-provided',
      multiFileClosureAttestation: 'not-provided-node-fs-denied',
      sourceBindings: 'post-load-observed-sources-not-executed-byte-attestation',
    },
    summary: { total: 18, passed, failed: 18 - passed, result: passed === 18 ? 'pass' : 'fail' },
    invocations,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const report = await runSuite({ candidatePath: process.argv[2], candidateName: process.argv[3] });
    process.stdout.write(`${JSON.stringify(report)}\n`);
    process.exitCode = report.summary.result === 'pass' ? 0 : 1;
  } catch {
    process.stderr.write('private-conformance-runner-error\n');
    process.exitCode = 2;
  }
}
