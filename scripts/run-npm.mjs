import { spawnSync } from 'node:child_process';
import path from 'node:path';

export function npmInvocation(args, platform = process.platform, execPath = process.execPath) {
  if (platform === 'win32') {
    const npmCli = path.win32.join(path.win32.dirname(execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    return { command: execPath, args: [npmCli, ...args] };
  }
  const npmCli = path.posix.join(path.posix.dirname(execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js');
  return { command: execPath, args: [npmCli, ...args] };
}

export function runNpmSync(args, options, runtime = {}) {
  const invocation = npmInvocation(args, runtime.platform, runtime.execPath);
  const result = (runtime.spawnSync ?? spawnSync)(invocation.command, invocation.args, options);
  const description = `npm ${args.join(' ')}`;
  if (result.error) {
    throw new Error(`${description} failed to start: ${result.error.message}`, { cause: result.error });
  }
  if (result.status !== 0) {
    const reason = result.signal ? `terminated by signal ${result.signal}` : `exited with status ${result.status ?? 'unknown'}`;
    const output = result.stderr || result.stdout;
    throw new Error(output ? `${description} ${reason}\n${output}` : `${description} ${reason}`);
  }
  return result.stdout;
}

export function pnpmVersionInvocation(platform = process.platform, comSpec = process.env.ComSpec) {
  if (platform === 'win32') {
    return { command: comSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'pnpm.cmd --version'] };
  }
  return { command: 'pnpm', args: ['--version'] };
}

export function runPnpmVersionSync(options, runtime = {}) {
  const invocation = pnpmVersionInvocation(runtime.platform, runtime.comSpec);
  const result = (runtime.spawnSync ?? spawnSync)(invocation.command, invocation.args, options);
  if (result.error) {
    throw new Error(`pnpm --version failed to start: ${result.error.message}`, { cause: result.error });
  }
  if (result.status !== 0) {
    const reason = result.signal ? `terminated by signal ${result.signal}` : `exited with status ${result.status ?? 'unknown'}`;
    const output = result.stderr || result.stdout;
    throw new Error(output ? `pnpm --version ${reason}\n${output}` : `pnpm --version ${reason}`);
  }
  const version = result.stdout.trim();
  if (!version) throw new Error('pnpm --version produced no version');
  return version;
}
