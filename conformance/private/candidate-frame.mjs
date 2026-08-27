import { createHash } from 'node:crypto';

export const CANDIDATE_FRAME_MAGIC = Buffer.from('AASCFV0\0', 'ascii');
export const CANDIDATE_FRAME_HEADER_BYTES = CANDIDATE_FRAME_MAGIC.length + 4 + 32;
export const MAX_CANDIDATE_FRAME_SOURCE_BYTES = 2_621_440;

export function createCandidateFrame(source) {
  if (!Buffer.isBuffer(source) || source.length < 1 || source.length > MAX_CANDIDATE_FRAME_SOURCE_BYTES) {
    throw new Error('invalid-candidate-frame-source');
  }
  const header = Buffer.alloc(CANDIDATE_FRAME_HEADER_BYTES);
  CANDIDATE_FRAME_MAGIC.copy(header, 0);
  header.writeUInt32BE(source.length, CANDIDATE_FRAME_MAGIC.length);
  createHash('sha256').update(source).digest().copy(header, CANDIDATE_FRAME_MAGIC.length + 4);
  return Buffer.concat([header, source]);
}

export const CANDIDATE_LOADER_SOURCE = `
import{readSync}from'node:fs';
import{createHash,timingSafeEqual}from'node:crypto';
const magic=Buffer.from('AASCFV0\\0','ascii'),header=Buffer.alloc(44);
const exact=(buffer,offset,length)=>{while(length>0){const count=readSync(3,buffer,offset,length,null);if(count===0)throw new Error('candidate-frame-truncated');offset+=count;length-=count}};
exact(header,0,header.length);
if(!header.subarray(0,8).equals(magic))throw new Error('candidate-frame-magic');
const length=header.readUInt32BE(8);
if(length<1||length>${MAX_CANDIDATE_FRAME_SOURCE_BYTES})throw new Error('candidate-frame-length');
const source=Buffer.alloc(length);exact(source,0,length);
const expected=header.subarray(12,44),actual=createHash('sha256').update(source).digest();
if(!timingSafeEqual(expected,actual))throw new Error('candidate-frame-digest');
await import('data:text/javascript;base64,'+source.toString('base64'))
`.trim().replace(/\n/g, '');
