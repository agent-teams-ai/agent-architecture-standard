import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const workspace = path.dirname(fileURLToPath(import.meta.url));

function pnpm(directory, ...args) {
  const result = spawnSync('pnpm', args, {
    cwd: directory,
    encoding: 'utf8',
    timeout: 60_000,
  });
  assert.ifError(result.error);
  return result;
}

async function installFixture(directory, name, engine) {
  const project = path.join(directory, name);
  const dependency = path.join(project, 'dependency');
  await mkdir(dependency, { recursive: true });
  await copyFile(path.join(workspace, 'pnpm-workspace.yaml'), path.join(project, 'pnpm-workspace.yaml'));
  await writeFile(path.join(project, 'package.json'), JSON.stringify({
    name: `engine-install-${name}`,
    private: true,
    dependencies: { 'engine-fixture': 'file:./dependency' },
  }));
  await writeFile(path.join(dependency, 'package.json'), JSON.stringify({
    name: 'engine-fixture',
    version: '1.0.0',
    engines: { node: engine },
  }));

  // Create a lock without installing, then exercise the real frozen install.
  // The override applies only to lock generation so the rejecting fixture can
  // have the same complete lockfile as a normal installation.
  const locked = pnpm(project, 'install', '--lockfile-only', '--engine-strict=false');
  assert.equal(locked.status, 0, locked.stdout + locked.stderr);
  return { project, result: pnpm(project, 'install', '--frozen-lockfile') };
}

test('Node 26 frozen install accepts a compatible dependency and rejects a Node 24 only dependency', async () => {
  assert.match(process.version, /^v26\./);
  const directory = await mkdtemp(path.join(workspace, '.engine-test-'));
  try {
    const compatible = await installFixture(directory, 'compatible', '>=26.10.0 <27');
    assert.equal(compatible.result.status, 0, compatible.result.stdout + compatible.result.stderr);
    const installed = JSON.parse(await readFile(path.join(compatible.project, 'node_modules/engine-fixture/package.json'), 'utf8'));
    assert.equal(installed.name, 'engine-fixture');

    const incompatible = await installFixture(directory, 'incompatible', '>=24 <25');
    assert.notEqual(incompatible.result.status, 0, 'Node 24 only dependency was installed under Node 26');
    assert.match(incompatible.result.stdout + incompatible.result.stderr, /ERR_PNPM_UNSUPPORTED_ENGINE/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
