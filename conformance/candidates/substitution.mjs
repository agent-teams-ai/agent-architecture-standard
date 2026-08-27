import { createInterface } from 'node:readline';
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  const request = JSON.parse(line);
  process.stdout.write(`${JSON.stringify({
    version: request.version,
    token: request.token,
    diagnostic: 'none',
    valueDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  })}\n`);
}
