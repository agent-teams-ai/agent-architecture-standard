import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  const request = JSON.parse(line);
  let diagnostic = 'none';
  let valueDigest = null;
  try {
    const value = JSON.parse(Buffer.from(request.input.base64, 'base64').toString('utf8'));
    valueDigest = `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
  } catch { diagnostic = 'aas.json.invalid-syntax'; }
  process.stdout.write(`${JSON.stringify({ version: request.version, token: request.token, diagnostic, valueDigest })}\n`);
}
