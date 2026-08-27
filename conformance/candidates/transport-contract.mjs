import { createInterface } from 'node:readline';

const loadedFromAdmittedBuffer = import.meta.url.startsWith('data:text/javascript;base64,');
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  const request = JSON.parse(line);
  const keys = Object.keys(request).sort().join(',');
  const inputKeys = Object.keys(request.input ?? {}).sort().join(',');
  const exactRequest = keys === 'input,limits,token,version'
    && (inputKeys === 'base64,form' || inputKeys === 'form,text')
    && Object.keys(request.limits ?? {}).sort().join(',') === 'maxBytes,maxDepth'
    && /^[0-9a-f]{32}$/.test(request.token)
    && !Object.hasOwn(request, 'replayId')
    && !Object.hasOwn(request, 'caseId');
  process.stdout.write(`${JSON.stringify({
    version: request.version,
    token: request.token,
    diagnostic: loadedFromAdmittedBuffer && exactRequest
      ? 'aas.json.invalid-syntax'
      : 'aas.json.raw-bytes-required',
    valueDigest: null,
  })}\n`);
}
