import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const files = readdirSync(new URL('../test/', import.meta.url)).filter((name) => name.endsWith('.test.mjs')).sort()
  .map((name) => fileURLToPath(new URL(`../test/${name}`, import.meta.url)));
const env = { ...process.env, npm_config_offline: 'true', npm_config_update_notifier: 'false' };
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
