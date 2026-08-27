import { createHash } from 'node:crypto';
export const sha256 = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
