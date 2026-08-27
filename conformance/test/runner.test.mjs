import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_BOUNDS, runSuite } from '../private/runner.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidate = (name) => path.join(root, 'candidates', name);
const fastBounds = Object.freeze({ ...DEFAULT_BOUNDS, invocationMilliseconds: 2000, settlementMilliseconds: 500 });
const timeoutBounds = Object.freeze({ ...DEFAULT_BOUNDS, invocationMilliseconds: 250, settlementMilliseconds: 500 });
const descendantBounds = Object.freeze({ ...DEFAULT_BOUNDS, invocationMilliseconds: 1500, settlementMilliseconds: 500 });
const isAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

test('independent candidate passes all 18 cases twice with a deterministic bound report', async () => {
  const options = { candidatePath: candidate('good-strict-json.mjs'), candidateName: 'independent-strict-json', bounds: fastBounds };
  const first = await runSuite(options);
  const second = await runSuite(options);
  assert.deepEqual(second, first);
  assert.deepEqual(first.summary, { total: 18, passed: 18, failed: 0, result: 'pass' });
  assert.equal(first.qualification, 'none-private-nonnormative');
  assert.equal(first.boundary.internalPrototypeSemantics, 'omitted-unobservable');
  assert.equal(first.boundary.networkIsolation, 'not-provided');
  assert.equal(first.boundary.runtimeBinaryAttestation, 'not-provided');
  assert.equal(first.boundary.multiFileClosureAttestation, 'not-provided');
  for (const value of Object.values(first.bindings)) assert.match(value, /^sha256:[0-9a-f]{64}$/);
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

test('report has a closed schema and does not echo candidate secrets, stderr, env, or paths', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'aas-report-schema-'));
  const artifact = path.join(directory, 'candidate.mjs');
  const secret = 'DO_NOT_ECHO_PRIVATE_SECRET';
  await writeFile(artifact, `process.stderr.write(${JSON.stringify(secret)});process.stdin.resume();process.stdin.once('data',()=>process.stdout.write(JSON.stringify({version:'private-aas-json-v0',token:'invalid',diagnostic:'none',valueDigest:null,data:${JSON.stringify(secret)}})+'\\n'));`);
  try {
    const report = await runSuite({ candidatePath: artifact, candidateName: 'bounded-name', bounds: fastBounds });
    assert.deepEqual(Object.keys(report).sort(), ['bindings', 'boundary', 'bounds', 'candidate', 'invocations', 'qualification', 'schemaVersion', 'summary']);
    assert.deepEqual(Object.keys(report.candidate).sort(), ['artifact', 'digest', 'name']);
    assert.deepEqual(Object.keys(report.summary).sort(), ['failed', 'passed', 'result', 'total']);
    assert.deepEqual(Object.keys(report.invocations[0]).sort(), ['cleanup', 'failure', 'observedDiagnostic', 'status', 'token']);
    const serialized = JSON.stringify(report);
    assert(!serialized.includes(secret));
    assert(!serialized.includes(directory));
    assert(!serialized.includes(process.env.PATH ?? 'path-not-present'));
    assert(report.invocations.every((item) => item.failure === 'malformed-response'));
    await assert.rejects(runSuite({ candidatePath: artifact, candidateName: '../unbounded/private/path', bounds: fastBounds }), /invalid-candidate-name/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('opaque requests expose neither case IDs nor oracle labels', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'aas-request-spy-'));
  const marker = path.join(directory, 'requests.jsonl');
  const artifact = path.join(directory, 'spy.mjs');
  await writeFile(artifact, `import{appendFileSync}from'node:fs';import{createInterface}from'node:readline';const r=createInterface({input:process.stdin,crlfDelay:Infinity});for await(const line of r){appendFileSync(${JSON.stringify(marker)},line+'\\n');const q=JSON.parse(line);process.stdout.write(JSON.stringify({version:q.version,token:q.token,diagnostic:'none',valueDigest:'sha256:0000000000000000000000000000000000000000000000000000000000000000'})+'\\n')}`);
  try {
    await runSuite({ candidatePath: artifact, candidateName: 'request-spy', bounds: fastBounds });
    const requests = (await readFile(marker, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(requests.length, 18);
    for (const request of requests) {
      assert.deepEqual(Object.keys(request).sort(), ['input', 'limits', 'token', 'version']);
      assert.match(request.token, /^[0-9a-f]{32}$/);
      const serialized = JSON.stringify(request);
      assert(!serialized.includes('caseId'));
      assert(!serialized.includes('expected'));
      assert(!serialized.includes('duplicate-key'));
      assert(!serialized.includes('raw-bytes-required'));
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('timeout kills and reaps the process tree within both deadlines', async () => {
  const started = Date.now();
  const report = await runSuite({ candidatePath: candidate('timeout.mjs'), candidateName: 'timeout', bounds: timeoutBounds });
  assert(report.invocations.every((item) => item.failure === 'timeout' && item.cleanup === 'confirmed'));
  assert(Date.now() - started < 10000);
});

test('spawned descendants holding pipes are killed with no surviving recorded PID', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'aas-descendant-proof-'));
  const marker = path.join(directory, 'pids.txt');
  const seeded = await readFile(candidate('descendant-pipe-holder.mjs'), 'utf8');
  const artifact = path.join(directory, 'descendant.mjs');
  const instrumented = seeded
    .replace("import { spawn } from 'node:child_process';", "import { spawn } from 'node:child_process';\nimport { appendFileSync } from 'node:fs';")
    .replace('child.unref();', `appendFileSync(${JSON.stringify(marker)}, String(child.pid) + '\\n');\nchild.unref();`);
  assert.notEqual(instrumented, seeded);
  await writeFile(artifact, instrumented);
  try {
    const started = Date.now();
    const report = await runSuite({ candidatePath: artifact, candidateName: 'descendant-proof', bounds: descendantBounds });
    assert(report.invocations.every((item) => item.failure === 'malformed-response' && item.cleanup === 'confirmed'));
    assert(Date.now() - started < 20000);
    const pids = (await readFile(marker, 'utf8')).trim().split('\n').map(Number);
    assert.equal(pids.length, 18);
    for (let attempt = 0; attempt < 20 && pids.some(isAlive); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.deepEqual(pids.filter(isAlive), []);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
