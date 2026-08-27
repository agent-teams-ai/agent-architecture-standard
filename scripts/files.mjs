import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseStrictJson } from '../lib/strict-json.mjs';

export const root = path.resolve(import.meta.dirname, '..');
export const slash = (value) => value.split(path.sep).join('/');
export async function walk(relative) {
  const start = path.join(root, relative);
  const out = [];
  async function visit(absolute) {
    for (const entry of await readdir(absolute, { withFileTypes: true })) {
      const next = path.join(absolute, entry.name);
      if (entry.isDirectory()) await visit(next);
      else if (entry.isFile()) out.push(slash(path.relative(root, next)));
    }
  }
  await visit(start);
  return out.sort();
}
export const readJson = async (relative) => parseStrictJson(await readFile(path.join(root, relative)));
