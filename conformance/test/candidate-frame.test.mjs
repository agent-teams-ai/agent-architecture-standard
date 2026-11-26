import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  CANDIDATE_FRAME_MAGIC,
  CANDIDATE_FRAME_HEADER_BYTES,
  CANDIDATE_LOADER_SOURCE,
  MAX_CANDIDATE_FRAME_SOURCE_BYTES,
  createCandidateFrame,
} from "../private/candidate-frame.mjs";
import { CANDIDATE_NODE_ARGS, validateResponse } from "../private/runner.mjs";

const args = ["--input-type=module", "--eval", CANDIDATE_LOADER_SOURCE];

function executeFrame(chunks, { keepOpen = false, input, nodeArgs = args } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, nodeArgs, {
      shell: false,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe", "pipe"],
      windowsHide: true,
      env: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
    });
    const stdout = [];
    const stderr = [];
    let processError;
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.stdio[3].on("error", () => {
      /* malformed frames may make the child close FD 3 early */
    });
    child.once("error", (error) => {
      processError = error;
    });
    child.stdin?.once("error", (error) => {
      processError ??= error;
    });
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* test timeout remains authoritative */
      }
      reject(new Error("candidate-frame-test-timeout"));
    }, 2000);
    child.once("close", (status, signal) => {
      clearTimeout(timer);
      child.stdio[3].destroy();
      if (processError) {
        reject(processError);
        return;
      }
      resolve({
        status,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    for (const chunk of chunks.slice(0, -1)) child.stdio[3].write(chunk);
    if (keepOpen) child.stdio[3].write(chunks.at(-1));
    else child.stdio[3].end(chunks.at(-1));
    if (input !== undefined) child.stdin.end(input);
  });
}

test("producer creates exactly one closed frame with valid bound source bytes", async () => {
  const source = Buffer.from("process.stdout.write('valid')");
  const frame = createCandidateFrame(source);
  assert.equal(frame.length, CANDIDATE_FRAME_HEADER_BYTES + source.length);
  assert.deepEqual(frame.subarray(CANDIDATE_FRAME_HEADER_BYTES), source);
  const result = await executeFrame([frame]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "valid");
});

test("candidate loader rejects bad magic, truncation, wrong digest, and oversized declared length", async () => {
  const valid = createCandidateFrame(Buffer.from("void 0"));
  const badMagic = Buffer.from(valid);
  badMagic[0] ^= 1;
  const wrongDigest = Buffer.from(valid);
  wrongDigest[12] ^= 1;
  const oversized = Buffer.alloc(CANDIDATE_FRAME_HEADER_BYTES);
  CANDIDATE_FRAME_MAGIC.copy(oversized);
  oversized.writeUInt32BE(MAX_CANDIDATE_FRAME_SOURCE_BYTES + 1, CANDIDATE_FRAME_MAGIC.length);
  for (const frame of [badMagic, valid.subarray(0, -1), wrongDigest, oversized]) {
    const result = await executeFrame([frame]);
    assert.notEqual(result.status, 0);
  }
});

test("exact-length read loops execute and exit while the parent deliberately keeps FD 3 open", async () => {
  const frame = createCandidateFrame(Buffer.from("process.stdout.write('complete')"));
  const result = await executeFrame(
    [frame.subarray(0, 3), frame.subarray(3, 17), frame.subarray(17)],
    { keepOpen: true },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "complete");
});

test("independent candidate preserves positive zero without admitting malformed or nonzero numbers", async () => {
  const source = await readFile(new URL("../candidates/good-strict-json.mjs", import.meta.url));
  const frame = createCandidateFrame(source);
  // Literal SHA-256 values of canonical bytes "0" and "1"; no parser-derived oracle.
  const zero = "sha256:5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9";
  const one = "sha256:6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b";
  const cases = [
    ["0.00", "none", zero],
    ["0e-2", "none", zero],
    ["0e17", "none", zero],
    ["0e10000000", "none", zero],
    ["0e-10000000", "none", zero],
    ["0.000e+10000000", "none", zero],
    ["10e-000000001", "none", one],
    ["-0.00", "aas.json.invalid-number", null],
    ["-0e10000000", "aas.json.invalid-number", null],
    ["-0e-10000000", "aas.json.invalid-number", null],
    ["1e-10000000", "aas.json.invalid-number", null],
    ["1.2", "aas.json.invalid-number", null],
    ["9007199254740992", "aas.json.invalid-number", null],
    ["0e", "aas.json.invalid-syntax", null],
    ["0e+", "aas.json.invalid-syntax", null],
    ["00", "aas.json.invalid-syntax", null],
  ];
  for (const [text, diagnostic, valueDigest] of cases) {
    const token = randomBytes(16).toString("hex");
    const request = JSON.stringify({
      version: "private-aas-json-v0",
      token,
      input: { form: "bytes", base64: Buffer.from(text).toString("base64") },
      limits: { maxBytes: 1024, maxDepth: 64 },
    });
    const result = await executeFrame([frame], {
      input: `${request}\n`,
      nodeArgs: CANDIDATE_NODE_ARGS,
    });
    assert.equal(result.status, 0, text);
    assert.equal(result.signal, null, text);
    assert.equal(result.stderr, "", text);
    assert.match(result.stdout, /^[^\r\n]+\n$/u, text);
    assert.deepEqual(
      validateResponse(result.stdout.slice(0, -1), token),
      { failure: "none", diagnostic, valueDigest },
      text,
    );
  }
});
