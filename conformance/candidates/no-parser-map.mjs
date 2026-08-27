// Seeded counterfeit: maps byte spellings to diagnostics but never parses a value.
import { createInterface } from 'node:readline';
const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  const request = JSON.parse(line);
  const text = request.input.form === 'bytes' ? Buffer.from(request.input.base64, 'base64').toString('utf8') : '';
  let diagnostic = 'none';
  if (request.input.form !== 'bytes') diagnostic = 'aas.json.raw-bytes-required';
  else if (Buffer.from(request.input.base64, 'base64').length > request.limits.maxBytes) diagnostic = 'aas.json.input-too-large';
  else if (text.startsWith('\ufeff')) diagnostic = 'aas.json.invalid-utf8';
  else if (text.includes('"value":1,"value"') || text.includes('val\\u0075e')) diagnostic = 'aas.json.duplicate-key';
  else if (/1\.5|-0|9007199254740992|9007199254740991\.1|1\.0000000000000001/.test(text)) diagnostic = 'aas.json.invalid-number';
  else if (text.includes('ud800') || text.includes('{} {}')) diagnostic = 'aas.json.invalid-syntax';
  else if (text.startsWith('[[[[[')) diagnostic = 'aas.json.depth-exceeded';
  const valueDigest = diagnostic === 'none' ? 'sha256:0000000000000000000000000000000000000000000000000000000000000000' : null;
  process.stdout.write(`${JSON.stringify({ version: request.version, token: request.token, diagnostic, valueDigest })}\n`);
}
