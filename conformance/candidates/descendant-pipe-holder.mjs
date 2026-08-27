import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
  detached: false,
  stdio: ['ignore', 'inherit', 'inherit'],
});
child.unref();
process.stdin.resume();
process.stdin.once('data', () => process.stdout.write('not-json\n'));
