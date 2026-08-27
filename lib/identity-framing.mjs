import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical-json.mjs';

const MAGIC = 'AAS-ID';
const CANONICAL_JSON_PROFILE = 'agent-architecture-canonical-json-rfc8785@0';
const DOMAINS = Object.freeze({
  binding: 'aas.binding.v0',
  bindingSet: 'aas.binding-set.v0',
  targetSelection: 'aas.target-selection.v0',
  overlay: 'aas.overlay.v0',
  analysisKey: 'aas.analysis.v0',
  profile: 'aas.profile.v0',
  effectivePolicy: 'aas.policy.v0',
  analyzer: 'aas.analyzer.v0',
  promotion: 'aas.promotion.v0',
  exception: 'aas.exception.v0',
  request: 'aas.request.v0',
  result: 'aas.result.v0',
  releaseManifest: 'aas.release-manifest.v0'
});

export const RESOURCE_ACCOUNTING_PROFILE_AAS_IDENTITY = 'aas:v0:sha256:aba07c457684cf217a74215a47e252aab23df9ed9242342a90167d6255365300';

const u32be = (value) => { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(value); return bytes; };
const u64be = (value) => { const bytes = Buffer.alloc(8); bytes.writeBigUInt64BE(BigInt(value)); return bytes; };

export function computeFramedIdentity(domainName, value, project) {
  const domain = DOMAINS[domainName];
  if (domain === undefined) throw new TypeError(`unknown private identity domain: ${domainName}`);
  const payload = Buffer.from(canonicalJson(project(value)), 'utf8');
  const magic = Buffer.from(MAGIC), domainBytes = Buffer.from(domain), profile = Buffer.from(CANONICAL_JSON_PROFILE);
  const frame = Buffer.concat([u32be(magic.length), magic, u32be(domainBytes.length), domainBytes,
    u32be(profile.length), profile, u64be(payload.length), payload]);
  return `aas:v0:sha256:${createHash('sha256').update(frame).digest('hex')}`;
}

const profileIdentityProjection = (profile) => {
  const projection = structuredClone(profile);
  delete projection.aasIdentity;
  return projection;
};

export const computeProfileAasIdentity = (profile) => computeFramedIdentity('profile', profile, profileIdentityProjection);
