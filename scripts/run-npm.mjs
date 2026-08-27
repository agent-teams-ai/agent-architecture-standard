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

export function pnpmVersionInvocation(pnpmHome, platform = process.platform, comSpec = process.env.ComSpec, workspaceRoot = process.cwd(), execPath = process.execPath) {
  const flavor = platform === 'win32' ? path.win32 : path.posix;
  if (typeof pnpmHome !== 'string' || !flavor.isAbsolute(pnpmHome)) throw new Error('PNPM_HOME must be an absolute trusted tool directory');
  const relative = flavor.relative(workspaceRoot, pnpmHome);
  if (relative === '' || (!relative.startsWith('..' + flavor.sep) && relative !== '..' && !flavor.isAbsolute(relative))) throw new Error('PNPM_HOME must be outside the workspace');
  if (platform === 'win32') {
    if (typeof execPath !== 'string' || !path.win32.isAbsolute(execPath)) throw new Error('Node executable must be an absolute trusted entrypoint');
    const cli = path.win32.resolve(pnpmHome, '..', 'pnpm', 'bin', 'pnpm.cjs');
    return { command: execPath, args: [cli, '--version'] };
  }
  return { command: path.posix.join(pnpmHome, 'pnpm'), args: ['--version'] };
}

export function runPnpmVersionSync(options, runtime = {}) {
  const invocation = pnpmVersionInvocation(runtime.pnpmHome ?? process.env.PNPM_HOME, runtime.platform, runtime.comSpec, runtime.workspaceRoot, runtime.execPath);
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
