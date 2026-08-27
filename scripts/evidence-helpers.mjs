import path from 'node:path';

export function parsePinnedPnpmVersion(packageManager) {
  const match = /^pnpm@((?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*))$/u.exec(packageManager ?? '');
  if (!match) throw new Error('package.json packageManager must be the exact pnpm@X.Y.Z version source');
  return match[1];
}

export function assertPnpmVersion(actual, expected) {
  if (typeof actual !== 'string' || actual.length === 0 || actual !== expected) throw new Error(`pnpm version mismatch: expected ${expected}, got ${actual || '<empty>'}`);
  return actual;
}

export function resolveEvidencePath(value, workspaceRoot) {
  if (!value || !path.isAbsolute(value)) throw new Error('AAS_EVIDENCE_PATH must be an absolute path outside the workspace');
  const output = path.resolve(value);
  const relative = path.relative(path.resolve(workspaceRoot), output);
  if (relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) throw new Error('AAS_EVIDENCE_PATH must be outside the workspace');
  return output;
}

export function assertCleanGitStatus(status, label) {
  if (typeof status !== 'string') throw new Error(`${label} git status is unavailable`);
  if (status.trim()) throw new Error(`${label} is dirty:\n${status.trim()}`);
}
