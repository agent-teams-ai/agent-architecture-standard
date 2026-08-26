import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, walk } from './files.mjs';
const temporary = await mkdtemp(path.join(tmpdir(), 'aas-generation-'));
try {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/generate.mjs')], { cwd: root, env: { ...process.env, AAS_GENERATE_ROOT: temporary }, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  const expected = ['artifacts.json', ...(await walk('generated'))];
  for (const relative of expected) {
    const checked = await readFile(path.join(root, relative));
    const fresh = await readFile(path.join(temporary, relative));
    if (!checked.equals(fresh)) throw new Error(`clean regeneration differs: ${relative}`);
  }
} finally { await rm(temporary, { recursive: true, force: true }); }
