import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  CANDIDATE_FRAME_MAGIC,
  CANDIDATE_FRAME_HEADER_BYTES,
  CANDIDATE_LOADER_SOURCE,
  MAX_CANDIDATE_FRAME_SOURCE_BYTES,
  createCandidateFrame,
} from '../private/candidate-frame.mjs';

const args = ['--input-type=module', '--eval', CANDIDATE_LOADER_SOURCE];

function executeFrame(chunks) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe', 'pipe'], windowsHide: true });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', reject);
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* test timeout remains authoritative */ }
      reject(new Error('candidate-frame-test-timeout'));
    }, 2000);
    child.once('close', (status, signal) => {
      clearTimeout(timer);
      resolve({ status, signal, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') });
    });
    for (const chunk of chunks.slice(0, -1)) child.stdio[3].write(chunk);
    child.stdio[3].end(chunks.at(-1));
  });
}

test('closed candidate frame accepts valid bound source bytes', async () => {
  const result = await executeFrame([createCandidateFrame(Buffer.from("process.stdout.write('valid')"))]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'valid');
});

test('closed candidate frame rejects truncation, surplus, wrong digest, and oversized declared length', async () => {
  const valid = createCandidateFrame(Buffer.from('void 0'));
  const wrongDigest = Buffer.from(valid);
  wrongDigest[12] ^= 1;
  const oversized = Buffer.alloc(CANDIDATE_FRAME_HEADER_BYTES);
  CANDIDATE_FRAME_MAGIC.copy(oversized);
  oversized.writeUInt32BE(MAX_CANDIDATE_FRAME_SOURCE_BYTES + 1, CANDIDATE_FRAME_MAGIC.length);
  for (const frame of [valid.subarray(0, -1), Buffer.concat([valid, Buffer.from([0])]), wrongDigest, oversized]) {
    const result = await executeFrame([frame]);
    assert.notEqual(result.status, 0);
  }
});

test('exact-length read loops complete when a valid frame arrives in fragments and closes', async () => {
  const frame = createCandidateFrame(Buffer.from("process.stdout.write('complete')"));
  const result = await executeFrame([frame.subarray(0, 3), frame.subarray(3, 17), frame.subarray(17)]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'complete');
});
