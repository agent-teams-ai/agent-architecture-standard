import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';

const INVALID = 'invalid-candidate-artifact';
const RACE = 'candidate-artifact-race';

const invalid = () => new Error(INVALID);
const race = () => new Error(RACE);

function canonicalPathname(value) {
  let normalized = path.normalize(value);
  if (process.platform === 'win32') {
    normalized = normalized.replace(/^\\\\\?\\/u, '').toLowerCase();
  }
  return normalized;
}

function sameFile(left, right) {
  return left.isFile() && right.isFile()
    && left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

async function pathnameEvidence(candidatePath) {
  const status = await lstat(candidatePath, { bigint: true });
  if (!status.isFile() || status.isSymbolicLink()) throw invalid();
  const resolved = await realpath(candidatePath);
  return { status, resolved: canonicalPathname(resolved) };
}

function admissionFlags() {
  let flags = constants.O_RDONLY;
  if (typeof constants.O_NOFOLLOW === 'number' && constants.O_NOFOLLOW !== 0) flags |= constants.O_NOFOLLOW;
  if (typeof constants.O_NONBLOCK === 'number' && constants.O_NONBLOCK !== 0) flags |= constants.O_NONBLOCK;
  return flags;
}

export async function admitCandidate(candidatePath, candidateBytes) {
  if (typeof candidatePath !== 'string' || candidatePath.length === 0
      || !Number.isSafeInteger(candidateBytes) || candidateBytes < 1) throw invalid();
  let handle;
  try {
    const before = await pathnameEvidence(candidatePath);
    if (before.status.size < 1n || before.status.size > BigInt(candidateBytes)) throw invalid();

    handle = await open(candidatePath, admissionFlags());
    const openedBefore = await handle.stat({ bigint: true });
    if (!sameFile(before.status, openedBefore)) throw race();

    const buffer = Buffer.allocUnsafe(candidateBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length < 1 || length > candidateBytes) throw invalid();

    const openedAfter = await handle.stat({ bigint: true });
    const after = await pathnameEvidence(candidatePath);
    if (before.resolved !== after.resolved
        || !sameFile(before.status, openedAfter)
        || !sameFile(before.status, after.status)
        || !sameFile(openedBefore, openedAfter)
        || openedAfter.size !== BigInt(length)) throw race();
    return Buffer.from(buffer.subarray(0, length));
  } catch (error) {
    if (error?.message === INVALID || error?.message === RACE) throw error;
    if (error?.code === 'ELOOP' || error?.code === 'EISDIR' || error?.code === 'ENXIO'
        || error?.code === 'EINVAL' || error?.code === 'ENOENT' || error?.code === 'ENOTDIR') throw invalid();
    throw invalid();
  } finally {
    try { await handle?.close(); } catch { /* admission already has a normalized outcome */ }
  }
}
