import { createInterface } from 'node:readline';

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  const request = JSON.parse(line);
  process.stdout.write(`${JSON.stringify({
    version: request.version,
    token: request.token,
    diagnostic: 'aas.json.invalid-syntax',
    valueDigest: null,
  })}\n`);
  await new Promise((resolve) => setTimeout(resolve, 25));
  process.stdout.write('delayed-junk\n');
}
