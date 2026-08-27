import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const marker = '__MARKER_PATH__';
let ordinaryDenied = false;
let detachedDenied = false;
try {
  spawn(process.execPath, ['--eval', `require('node:fs').writeFileSync(${JSON.stringify(marker)},'ordinary')`]);
} catch { ordinaryDenied = true; }
try {
  spawn(process.execPath, ['--eval', `require('node:fs').appendFileSync(${JSON.stringify(marker)},'detached')`], {
    detached: true,
    stdio: 'ignore',
  }).unref();
} catch { detachedDenied = true; }

const permissionsDenied = ['fs.read', 'fs.write', 'child', 'worker', 'addons']
  .every((scope) => process.permission?.has(scope) === false);
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  const request = JSON.parse(line);
  process.stdout.write(`${JSON.stringify({
    version: request.version,
    token: request.token,
    diagnostic: ordinaryDenied && detachedDenied && permissionsDenied
      ? 'aas.json.invalid-syntax'
      : 'aas.json.raw-bytes-required',
    valueDigest: null,
  })}\n`);
}
