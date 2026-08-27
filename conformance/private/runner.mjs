#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadOracleCases } from './oracle.mjs';

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

export const DEFAULT_BOUNDS = Object.freeze({
  candidateBytes: 262144,
  candidateNameBytes: 64,
  requestBytes: 1500000,
  responseBytes: 4096,
  stderrBytes: 4096,
  invocationMilliseconds: 2000,
  settlementMilliseconds: 1000,
});

const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const ownKeysAre = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');

function validateBounds(value) {
  if (!ownKeysAre(value, Object.keys(DEFAULT_BOUNDS))) throw new Error('invalid-bounds');
  for (const [key, defaultValue] of Object.entries(DEFAULT_BOUNDS)) {
    if (!Number.isSafeInteger(value[key]) || value[key] < 1 || value[key] > defaultValue * 10) throw new Error('invalid-bounds');
  }
  return Object.freeze({ ...value });
}

function boundedCandidateName(name, bounds) {
  if (typeof name !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)
      || Buffer.byteLength(name) > bounds.candidateNameBytes) throw new Error('invalid-candidate-name');
  return name;
}

function candidateEnvironment(stage) {
  const executableDirectory = path.dirname(process.execPath);
  return Object.freeze({
    HOME: stage,
    LANG: 'C',
    LC_ALL: 'C',
    PATH: executableDirectory,
    TEMP: stage,
    TMP: stage,
    TMPDIR: stage,
    TZ: 'UTC',
  });
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForExit(child, milliseconds) {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return Promise.race([
    new Promise((resolve) => child.once('exit', () => resolve(true))),
    delay(milliseconds).then(() => false),
  ]);
}

async function taskkill(pid, milliseconds) {
  let utility;
  try {
    utility = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], {
      shell: false,
      windowsHide: true,
      stdio: 'ignore',
    });
  } catch { return false; }
  return Promise.race([
    new Promise((resolve) => utility.once('exit', (code) => resolve(code === 0))),
    delay(milliseconds).then(() => { utility.kill(); return false; }),
  ]);
}

async function terminateTree(child, bounds) {
  if (!child.pid) return false;
  let requested = false;
  if (process.platform === 'win32') {
    requested = await taskkill(child.pid, bounds.settlementMilliseconds);
    if (!requested) requested = child.kill('SIGKILL');
  } else {
    try { process.kill(-child.pid, 'SIGKILL'); requested = true; } catch (error) {
      if (error.code === 'ESRCH') requested = true;
      else { try { requested = child.kill('SIGKILL'); } catch { requested = false; } }
    }
  }
  const reaped = await waitForExit(child, bounds.settlementMilliseconds);
  child.stdin?.destroy();
  child.stdout?.destroy();
  child.stderr?.destroy();
  if (process.platform !== 'win32') {
    const deadline = Date.now() + bounds.settlementMilliseconds;
    while (Date.now() <= deadline) {
      try { process.kill(-child.pid, 0); } catch (error) {
        if (error.code === 'ESRCH') return requested && reaped;
      }
      await delay(10);
    }
    return false;
  }
  return requested && reaped;
}

function validateResponse(line, expectedToken, bounds) {
  if (Buffer.byteLength(line) > bounds.responseBytes) return { failure: 'response-too-large' };
  let value;
  try { value = JSON.parse(line); } catch { return { failure: 'malformed-response' }; }
  const keys = ['version', 'token', 'diagnostic', 'valueDigest'];
  if (!ownKeysAre(value, keys)) return { failure: 'unexpected-response-field' };
  if (value.version !== PROTOCOL || value.token !== expectedToken || !TOKEN.test(value.token)
      || typeof value.diagnostic !== 'string' || value.diagnostic.length > 64 || !DIAGNOSTICS.has(value.diagnostic)
      || !(value.valueDigest === null || (typeof value.valueDigest === 'string' && DIGEST.test(value.valueDigest)))
      || (value.diagnostic === 'none') !== (value.valueDigest !== null)) {
    return { failure: 'malformed-response' };
  }
  return { failure: 'none', diagnostic: value.diagnostic, valueDigest: value.valueDigest };
}

async function executeOne(candidateBytes, candidateDigest, request, bounds) {
  const stage = await mkdtemp(path.join(tmpdir(), 'aas-private-json-'));
  const artifact = path.join(stage, 'candidate.mjs');
  let child;
  try {
    await writeFile(artifact, candidateBytes, { flag: 'wx', mode: 0o500 });
    if (sha256(await readFile(artifact)) !== candidateDigest) throw new Error('staged-digest-mismatch');
    const encoded = `${JSON.stringify(request)}\n`;
    if (Buffer.byteLength(encoded) > bounds.requestBytes) throw new Error('request-too-large');
    try {
      child = spawn(process.execPath, ['--no-addons', '--disable-proto=delete', 'candidate.mjs'], {
        cwd: stage,
        detached: process.platform !== 'win32',
        env: candidateEnvironment(stage),
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch { return { failure: 'launch-failed', diagnostic: null, cleanup: 'not-needed' }; }

    let stdout = Buffer.alloc(0);
    let stderrBytes = 0;
    let forcedFailure = null;
    let terminating = false;
    let cleanupConfirmed = false;
    let terminationPromise;
    let notifyTermination;
    const terminationReady = new Promise((resolve) => { notifyTermination = () => resolve('terminated'); });
    const termination = async (failure) => {
      if (terminating) return terminationPromise;
      terminating = true;
      notifyTermination();
      terminationPromise = (async () => {
        forcedFailure = failure;
        cleanupConfirmed = await terminateTree(child, bounds);
        if (!cleanupConfirmed) forcedFailure = 'settlement-timeout';
      })();
      return terminationPromise;
    };
    child.stdout.on('data', (chunk) => {
      stdout = Buffer.concat([stdout, chunk], Math.min(stdout.length + chunk.length, bounds.responseBytes + 1));
      if (stdout.length > bounds.responseBytes) void termination('response-too-large');
    });
    child.stderr.on('data', (chunk) => {
      stderrBytes += chunk.length;
      void termination(stderrBytes > bounds.stderrBytes ? 'response-too-large' : 'malformed-response');
    });
    child.on('error', () => { forcedFailure = 'launch-failed'; });
    child.stdin.write(encoded);

    const closed = new Promise((resolve) => child.once('close', () => resolve('closed')));
    const exited = new Promise((resolve) => child.once('exit', () => resolve('exited')));
    const responseReady = new Promise((resolve) => child.stdout.on('data', () => {
      if (stdout.includes(0x0a)) resolve('response');
    }));
    const first = await Promise.race([responseReady, terminationReady, closed, exited, delay(bounds.invocationMilliseconds).then(() => 'timeout')]);
    if (first === 'timeout') await termination('timeout');
    else if (first === 'exited') {
      const settled = await Promise.race([closed, delay(bounds.settlementMilliseconds).then(() => 'unsettled')]);
      if (settled === 'unsettled') await termination('settlement-timeout');
    } else if (first === 'response') {
      await termination('none');
    }
    if (terminating) await terminationPromise;
    if (forcedFailure && forcedFailure !== 'none') return { failure: forcedFailure, diagnostic: null, cleanup: cleanupConfirmed ? 'confirmed' : 'unconfirmed' };
    if ((!terminating && child.exitCode !== 0) || stderrBytes !== 0) return { failure: 'malformed-response', diagnostic: null, cleanup: terminating ? 'confirmed' : 'not-needed' };
    const text = stdout.toString('utf8');
    if (!text.endsWith('\n') || text.slice(0, -1).includes('\n')) return { failure: 'malformed-response', diagnostic: null, cleanup: 'not-needed' };
    const checked = validateResponse(text.slice(0, -1), request.token, bounds);
    return { ...checked, cleanup: terminating ? 'confirmed' : 'not-needed' };
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) await terminateTree(child, bounds);
    await rm(stage, { recursive: true, force: true });
  }
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
      || !ownKeysAre(report.bindings, ['suiteDigest', 'corpusDigest', 'oracleDigest', 'runnerDigest', 'candidateDigest', 'inputDigest', 'toolchainId', 'boundsId', 'replayId'])
      || !ownKeysAre(report.boundary, ['adapter', 'internalPrototypeSemantics', 'filesystemSandbox', 'networkIsolation', 'runtimeBinaryAttestation', 'multiFileClosureAttestation'])
      || !ownKeysAre(report.summary, ['total', 'passed', 'failed', 'result'])
      || !ownKeysAre(report.bounds, Object.keys(DEFAULT_BOUNDS))
      || report.schemaVersion !== 'private-aas-conformance-report-v0'
      || report.qualification !== 'none-private-nonnormative'
      || Object.values(report.bindings).some((value) => typeof value !== 'string' || !DIGEST.test(value))
      || Object.values(report.boundary).some((value) => typeof value !== 'string' || Buffer.byteLength(value) > 64)
      || report.summary.total !== 18 || report.summary.passed + report.summary.failed !== 18
      || !['pass', 'fail'].includes(report.summary.result) || report.invocations.length !== 18) {
    throw new Error('internal-report-schema');
  }
  for (const item of report.invocations) {
    if (!ownKeysAre(item, ['token', 'status', 'failure', 'observedDiagnostic', 'cleanup'])
        || !TOKEN.test(item.token) || !['pass', 'fail'].includes(item.status)
        || !FAILURE_CODES.has(item.failure) || !(item.observedDiagnostic === null || DIAGNOSTICS.has(item.observedDiagnostic))
        || !['not-needed', 'confirmed', 'unconfirmed'].includes(item.cleanup)) throw new Error('internal-report-schema');
  }
  return report;
}

export async function runSuite({ candidatePath, candidateName, bounds: suppliedBounds = DEFAULT_BOUNDS }) {
  const bounds = validateBounds(suppliedBounds);
  const name = boundedCandidateName(candidateName, bounds);
  const stat = await lstat(candidatePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > bounds.candidateBytes) throw new Error('invalid-candidate-artifact');
  const candidateBytes = await readFile(candidatePath);
  if (candidateBytes.length !== stat.size) throw new Error('candidate-artifact-race');
  const candidateDigest = sha256(candidateBytes);
  const oracle = await loadOracleCases();
  const oracleBytes = await readFile(new URL('./oracle.mjs', import.meta.url));
  const runnerBytes = await readFile(fileURLToPath(import.meta.url));
  const suiteDescriptor = Buffer.from(`${PROTOCOL}\nstrict-json-corpus-18\nprivate-nonnormative\n`);
  const suiteDigest = sha256(suiteDescriptor);
  const oracleDigest = sha256(oracleBytes);
  const runnerDigest = sha256(runnerBytes);
  const inputDigest = sha256(Buffer.concat(oracle.cases.flatMap((item) => [
    Buffer.from(`${item.form}\0${item.limits.maxBytes}\0${item.limits.maxDepth}\0${item.bytes.length}\0`), item.bytes,
  ])));
  const toolchainId = sha256(Buffer.from(`node:${process.version}\0${process.platform}\0${process.arch}`));
  const boundsId = sha256(Buffer.from(JSON.stringify(bounds)));
  const replayId = sha256(Buffer.from([suiteDigest, oracle.corpusDigest, oracleDigest, runnerDigest, candidateDigest, inputDigest, toolchainId, boundsId].join('\n')));
  const invocations = [];
  for (let index = 0; index < oracle.cases.length; index += 1) {
    const item = oracle.cases[index];
    const token = createHash('sha256').update(`${replayId}\0${index}`).digest('hex').slice(0, 32);
    const observed = await executeOne(candidateBytes, candidateDigest, requestFor(item, token), bounds);
    const matched = observed.failure === 'none' && observed.diagnostic === item.diagnostic && observed.valueDigest === item.valueDigest;
    invocations.push({
      token,
      status: matched ? 'pass' : 'fail',
      failure: matched ? 'none' : (observed.failure === 'none' ? 'oracle-mismatch' : observed.failure),
      observedDiagnostic: observed.diagnostic ?? null,
      cleanup: observed.cleanup,
    });
  }
  const passed = invocations.filter((item) => item.status === 'pass').length;
  return validateReport({
    schemaVersion: 'private-aas-conformance-report-v0',
    qualification: 'none-private-nonnormative',
    candidate: { name, digest: candidateDigest, artifact: 'hash-verified-single-file-node-esm' },
    bindings: { suiteDigest, corpusDigest: oracle.corpusDigest, oracleDigest, runnerDigest, candidateDigest, inputDigest, toolchainId, boundsId, replayId },
    bounds,
    boundary: {
      adapter: 'private-nonnormative-no-public-v0-transport',
      internalPrototypeSemantics: 'omitted-unobservable',
      filesystemSandbox: 'not-provided',
      networkIsolation: 'not-provided',
      runtimeBinaryAttestation: 'not-provided',
      multiFileClosureAttestation: 'not-provided',
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
