import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import childProcess, { spawnSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CANDIDATE_LOADER_SOURCE,
  CANDIDATE_NODE_ARGS,
  DEFAULT_BOUNDS,
  createTransportPlan,
  runSuite,
  validateResponse,
  verifyNodePermissionContract,
} from '../private/runner.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidate = (name) => path.join(root, 'candidates', name);
const fastBounds = Object.freeze({ ...DEFAULT_BOUNDS, invocationMilliseconds: 1500, settlementMilliseconds: 500 });
const timeoutBounds = Object.freeze({ ...DEFAULT_BOUNDS, invocationMilliseconds: 250, settlementMilliseconds: 500 });

test('independent candidate passes twice with deterministic reports that omit random transport state', async () => {
  const options = { candidatePath: candidate('good-strict-json.mjs'), candidateName: 'independent-strict-json', bounds: fastBounds };
  const first = await runSuite(options);
  const second = await runSuite(options);
  assert.deepEqual(second, first);
  assert.deepEqual(first.summary, { total: 18, passed: 18, failed: 0, result: 'pass' });
  assert.equal(first.qualification, 'none-private-nonnormative');
  assert.equal(first.candidate.artifact, 'admitted-handle-bytes-data-url-node-esm');
  assert.equal(first.boundary.nodePermissionControls, 'fs-child-worker-addon-denied');
  assert.equal(first.boundary.networkIsolation, 'not-controlled-by-node24-permissions');
  assert.equal(first.boundary.osProcessContainment, 'windows-tree-containment-absent-posix-group-or-bounded-root-termination-closure-attempt-only');
  assert.equal(first.boundary.runtimeExecutionAttestation, 'not-provided');
  assert.equal(first.boundary.sourceBindings, 'post-load-observed-sources-not-executed-byte-attestation');
  for (const value of Object.values(first.bindings)) assert.match(value, /^sha256:[0-9a-f]{64}$/);
  assert(!JSON.stringify(first).includes('token'));
  assert(!JSON.stringify(first).includes('nonce'));
});

test('transport tokens and order are cryptographically fresh and independent of replayId', () => {
  const plans = Array.from({ length: 4 }, () => createTransportPlan(18));
  for (const plan of plans) {
    assert.deepEqual([...plan.map(({ caseIndex }) => caseIndex)].sort((a, b) => a - b), Array.from({ length: 18 }, (_, index) => index));
    assert.equal(new Set(plan.map(({ token }) => token)).size, 18);
    for (const { token } of plan) assert.match(token, /^[0-9a-f]{32}$/);
  }
  assert.equal(new Set(plans.flatMap((plan) => plan.map(({ token }) => token))).size, 72);
  assert(new Set(plans.map((plan) => plan.map(({ caseIndex }) => caseIndex).join(','))).size > 1);
});

test('the exact candidate command enables the fail-closed Node 24 permission contract', async () => {
  assert.deepEqual(CANDIDATE_NODE_ARGS, [
    '--permission', '--no-addons', '--disable-proto=delete', '--input-type=module', '--eval', CANDIDATE_LOADER_SOURCE,
  ]);
  assert(!CANDIDATE_NODE_ARGS.some((argument) => argument.startsWith('--allow-')));
  assert.doesNotMatch(CANDIDATE_LOADER_SOURCE, /readFileSync/);
  assert.match(CANDIDATE_LOADER_SOURCE, /readSync\(3/);
  assert.match(CANDIDATE_LOADER_SOURCE, /candidate-frame-(?:magic|length|truncated|digest)/);
  assert.doesNotMatch(CANDIDATE_LOADER_SOURCE, /surplus/);
  assert.match(CANDIDATE_LOADER_SOURCE, /data:text\/javascript;base64/);
  assert.equal(await verifyNodePermissionContract(), true);
});

test('the admitted buffer executes as a data URL with only the closed opaque request', async () => {
  const report = await runSuite({
    candidatePath: candidate('transport-contract.mjs'),
    candidateName: 'transport-contract',
    bounds: fastBounds,
  });
  assert(report.invocations.every((item) => item.observedDiagnostic === 'aas.json.invalid-syntax'));
});

test('strict response parser rejects every escaped key while retaining strict value escapes', () => {
  const token = '0123456789abcdef0123456789abcdef';
  const valid = `{"version":"private-aas-json-v0","token":"${token}","diagnostic":"aas.json.invalid-syntax","valueDigest":null}`;
  assert.equal(validateResponse(valid, token).failure, 'none');
  assert.equal(validateResponse(valid.replace('{', '{"token":"other",'), token).failure, 'malformed-response');
  assert.equal(validateResponse(valid.replace('{', '{"tok\\u0065n":"other",'), token).failure, 'malformed-response');
  assert.equal(validateResponse(valid.replace('"version"', '"vers\\u0069on"'), token).failure, 'malformed-response');
  assert.equal(validateResponse(valid.replace('private-aas-json-v0', 'private-aas-json-v\\u0030'), token).failure, 'none');
});

test('seeded substitution, diagnostic map, and ordinary JSON parser cannot pass', async () => {
  for (const file of ['substitution.mjs', 'no-parser-map.mjs', 'bad-json-parse.mjs']) {
    const report = await runSuite({ candidatePath: candidate(file), candidateName: file, bounds: fastBounds });
    assert.equal(report.summary.result, 'fail', file);
    assert(report.summary.passed < 18, file);
    assert(report.invocations.some((item) => item.failure === 'oracle-mismatch'), file);
  }
});

test('malformed and oversized candidate output is closed and bounded', async () => {
  const malformed = await runSuite({ candidatePath: candidate('malformed-output.mjs'), candidateName: 'malformed', bounds: fastBounds });
  assert(malformed.invocations.every((item) => item.failure === 'malformed-response'));
  const oversized = await runSuite({ candidatePath: candidate('oversized-output.mjs'), candidateName: 'oversized', bounds: fastBounds });
  assert(oversized.invocations.every((item) => item.failure === 'response-too-large'));
  assert(JSON.stringify(oversized).length < 16000);
});

test('a valid first response followed by delayed stdout junk is rejected', async () => {
  const report = await runSuite({
    candidatePath: candidate('delayed-surplus-output.mjs'),
    candidateName: 'delayed-surplus',
    bounds: fastBounds,
  });
  assert(report.invocations.every((item) => item.failure === 'malformed-response'));
  assert(report.invocations.every((item) => item.cleanup === 'bounded-attempt-complete'));
});

test('report is closed and does not echo candidate secrets, stderr, env, or paths', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'aas-report-schema-'));
  const artifact = path.join(directory, 'candidate.mjs');
  const secret = 'DO_NOT_ECHO_PRIVATE_SECRET';
  await writeFile(artifact, `process.stderr.write(${JSON.stringify(secret)});process.stdin.resume()`);
  try {
    const report = await runSuite({ candidatePath: artifact, candidateName: 'bounded-name', bounds: fastBounds });
    assert.deepEqual(Object.keys(report).sort(), ['bindings', 'boundary', 'bounds', 'candidate', 'invocations', 'qualification', 'schemaVersion', 'summary']);
    assert.deepEqual(Object.keys(report.candidate).sort(), ['artifact', 'digest', 'name']);
    assert.deepEqual(Object.keys(report.invocations[0]).sort(), ['cleanup', 'failure', 'observedDiagnostic', 'status']);
    const serialized = JSON.stringify(report);
    assert(!serialized.includes(secret));
    assert(!serialized.includes(directory));
    assert(!serialized.includes(process.env.PATH ?? 'path-not-present'));
    await assert.rejects(runSuite({ candidatePath: artifact, candidateName: '../unbounded/private/path', bounds: fastBounds }), /invalid-candidate-name/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('candidate admission rejects oversized artifacts from the opened handle', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'aas-admission-'));
  const oversized = path.join(directory, 'oversized.mjs');
  await writeFile(oversized, Buffer.alloc(65));
  const bounds = { ...fastBounds, candidateBytes: 64 };
  try {
    await assert.rejects(runSuite({ candidatePath: oversized, candidateName: 'oversized', bounds }), /invalid-candidate-artifact/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('POSIX candidate admission rejects a symlink and FIFO without opening a blocking reader', { skip: process.platform === 'win32' }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'aas-posix-admission-'));
  const artifact = path.join(directory, 'candidate.mjs');
  const link = path.join(directory, 'link.mjs');
  const fifo = path.join(directory, 'candidate.fifo');
  await writeFile(artifact, 'process.exit(0)');
  await symlink(artifact, link);
  const made = spawnSync('mkfifo', [fifo], { encoding: 'utf8', timeout: 1000 });
  assert.equal(made.status, 0, made.stderr);
  try {
    await assert.rejects(runSuite({ candidatePath: link, candidateName: 'link', bounds: fastBounds }), /invalid-candidate-artifact/);
    await assert.rejects(runSuite({ candidatePath: fifo, candidateName: 'fifo', bounds: fastBounds }), /invalid-candidate-artifact/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Windows candidate admission rejects supported final-path symlink and non-file junction reparse points', { skip: process.platform !== 'win32' }, async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'aas-windows-admission-'));
  const artifact = path.join(directory, 'candidate.mjs');
  const link = path.join(directory, 'link.mjs');
  const targetDirectory = path.join(directory, 'target-directory');
  const junction = path.join(directory, 'candidate-junction');
  await writeFile(artifact, 'process.exit(0)');
  await mkdir(targetDirectory);
  let exercised = 0;
  try {
    try {
      await symlink(artifact, link, 'file');
      await assert.rejects(runSuite({ candidatePath: link, candidateName: 'file-reparse', bounds: fastBounds }), /invalid-candidate-artifact/);
      exercised += 1;
    } catch (error) {
      if (!['EPERM', 'EACCES', 'UNKNOWN'].includes(error?.code)) throw error;
    }
    await symlink(targetDirectory, junction, 'junction');
    await assert.rejects(runSuite({ candidatePath: junction, candidateName: 'junction-reparse', bounds: fastBounds }), /invalid-candidate-artifact/);
    exercised += 1;
    assert(exercised > 0);
  } catch (error) {
    if (exercised === 0 && ['EPERM', 'EACCES', 'UNKNOWN'].includes(error?.code)) context.skip(`reparse creation unavailable: ${error.code}`);
    else throw error;
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('Windows teardown never launches an external helper from hostile CWD, PATH, SystemRoot, or NODE_OPTIONS', { skip: process.platform !== 'win32' }, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'aas-hostile-helper-'));
  const hostileRoot = path.join(directory, 'Windows');
  const system32 = path.join(hostileRoot, 'System32');
  const bareFake = path.join(directory, 'taskkill.exe');
  const derivedFake = path.join(system32, 'taskkill.exe');
  const hook = path.join(directory, 'marker-hook.cjs');
  const marker = path.join(directory, 'fake-helper-invoked');
  const previous = {
    cwd: process.cwd(),
    path: process.env.PATH,
    systemRoot: process.env.SystemRoot,
    windir: process.env.windir,
    nodeOptions: process.env.NODE_OPTIONS,
    spawn: childProcess.spawn,
  };
  let externalLaunchAttempt = false;
  await mkdir(system32, { recursive: true });
  await copyFile(process.execPath, bareFake);
  await copyFile(process.execPath, derivedFake);
  await writeFile(hook, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'invoked')`);
  try {
    process.chdir(directory);
    process.env.PATH = directory;
    process.env.SystemRoot = hostileRoot;
    process.env.windir = hostileRoot;
    process.env.NODE_OPTIONS = `--require=${hook}`;
    childProcess.spawn = (file, ...args) => {
      if (file !== process.execPath) {
        externalLaunchAttempt = true;
        throw new Error('unexpected-external-helper');
      }
      return previous.spawn(file, ...args);
    };
    syncBuiltinESMExports();
    const bounds = Object.freeze({ ...DEFAULT_BOUNDS, invocationMilliseconds: 50, settlementMilliseconds: 500 });
    const report = await runSuite({ candidatePath: candidate('timeout.mjs'), candidateName: 'hostile-helper', bounds });
    assert(report.invocations.every((item) => item.failure === 'timeout'));
    assert(report.invocations.every((item) => item.cleanup === 'bounded-attempt-complete'));
    assert.equal(externalLaunchAttempt, false);
    await assert.rejects(readFile(marker), (error) => error?.code === 'ENOENT');
  } finally {
    childProcess.spawn = previous.spawn;
    syncBuiltinESMExports();
    process.chdir(previous.cwd);
    if (previous.path === undefined) delete process.env.PATH; else process.env.PATH = previous.path;
    if (previous.systemRoot === undefined) delete process.env.SystemRoot; else process.env.SystemRoot = previous.systemRoot;
    if (previous.windir === undefined) delete process.env.windir; else process.env.windir = previous.windir;
    if (previous.nodeOptions === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = previous.nodeOptions;
    await rm(directory, { recursive: true, force: true });
  }
});

test('early exit, delayed response, and a pipe-holding root return bounded reports without EPIPE', async () => {
  const started = Date.now();
  const early = await runSuite({ candidatePath: candidate('early-root-exit.mjs'), candidateName: 'early-exit', bounds: fastBounds });
  assert(early.invocations.every((item) => item.failure === 'malformed-response'));
  const delayed = await runSuite({ candidatePath: candidate('timeout.mjs'), candidateName: 'delayed', bounds: timeoutBounds });
  assert(delayed.invocations.every((item) => item.failure === 'timeout'));
  const holder = await runSuite({ candidatePath: candidate('pipe-holder.mjs'), candidateName: 'pipe-holder', bounds: fastBounds });
  assert(holder.invocations.every((item) => item.failure === 'settlement-timeout'));
  for (const report of [early, delayed]) {
    assert(report.invocations.every((item) => item.cleanup === 'bounded-attempt-complete'));
  }
  assert(holder.invocations.every((item) => item.cleanup === 'bounded-attempt-complete'));
  assert(Date.now() - started < 30000);
});

test('permission mode denies ordinary and detached descendants so no child marker survives', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'aas-spawn-denial-'));
  const marker = path.join(directory, 'child-marker');
  const artifact = path.join(directory, 'spawn-attempts.mjs');
  const seeded = await readFile(candidate('permission-spawn-attempts.mjs'), 'utf8');
  await writeFile(artifact, seeded.replace("'__MARKER_PATH__'", JSON.stringify(marker)));
  try {
    const report = await runSuite({ candidatePath: artifact, candidateName: 'spawn-denial', bounds: fastBounds });
    assert(report.invocations.every((item) => item.observedDiagnostic === 'aas.json.invalid-syntax'));
    assert(report.invocations.every((item) => item.cleanup === 'bounded-attempt-complete'));
    await assert.rejects(readFile(marker), (error) => error?.code === 'ENOENT');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
